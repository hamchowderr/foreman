import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { MastraAuthClerk } from "@mastra/auth-clerk";
import { Observability, ConsoleExporter, DefaultExporter } from "@mastra/observability";
import { toAISdkStream } from "@mastra/ai-sdk";
import { registerApiRoute } from "@mastra/core/server";
import { RequestContext } from "@mastra/core/request-context";
import { createUIMessageStreamResponse } from "ai";
import type { Agent } from "@mastra/core/agent";
import { createForemanAgent } from "./agents/foreman";
import { createDiscoveryAgent } from "./agents/discovery";
import { createExecutionAgent } from "./agents/execution";
import { createHistoryAgent } from "./agents/history";
import { createSupervisorAgent } from "./agents/supervisor";
import { webhookHandlerWorkflow } from "../workflows/webhook-handler";
import type { MiddlewareHandler } from "hono";

let _mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  const storage = new LibSQLStore({
    id: "foreman-storage",
    url: databaseUrl,
  });

  const foremanAgent = createForemanAgent(databaseUrl);
  const discoveryAgent = createDiscoveryAgent();
  const executionAgent = createExecutionAgent();
  const historyAgent = createHistoryAgent();
  const supervisorAgent = createSupervisorAgent({
    databaseUrl,
    discoveryAgent,
    executionAgent,
    historyAgent,
  });

  const customMiddleware: MiddlewareHandler = async (c, next) => {
    const { default: customRoutes } = await import("../routes");
    const response = await customRoutes.fetch(c.req.raw);
    if (response.status !== 404) {
      return response;
    }
    await next();
  };

  const otelEnabled = process.env.OTEL_ENABLED === "true";

  const observability = otelEnabled
    ? new Observability({
        configs: {
          default: {
            serviceName: "foreman-agents",
            exporters: [new DefaultExporter(), new ConsoleExporter()],
          },
        },
      })
    : undefined;

  /**
   * Fix the stream format mismatch between @mastra/ai-sdk and the AI SDK v6 protocol.
   *
   * toAISdkStream emits { type: "data-tool-call-approval", data: { runId, toolCallId } }
   * but the AI SDK client expects { type: "tool-approval-request", approvalId, toolCallId }.
   * Without this transform, approval-required tools stay stuck in "Running" state.
   */
  function fixApprovalStream(stream: ReadableStream): ReadableStream {
    return stream.pipeThrough(
      new TransformStream({
        transform(chunk: any, controller) {
          if (chunk.type === "data-tool-call-approval") {
            // Convert to the format the AI SDK client expects.
            // Use the Mastra runId as the approvalId — the frontend will send
            // this back when the user approves/declines so we can call
            // agent.approveToolCall({ runId }) / agent.declineToolCall({ runId }).
            controller.enqueue({
              type: "tool-approval-request",
              approvalId: chunk.data.runId,
              toolCallId: chunk.data.toolCallId,
            });
          } else {
            controller.enqueue(chunk);
          }
        },
      }),
    );
  }

  _mastra = new Mastra({
    agents: {
      foreman: foremanAgent,
      discovery: discoveryAgent,
      execution: executionAgent,
      history: historyAgent,
      supervisor: supervisorAgent,
    },
    workflows: {
      webhookHandler: webhookHandlerWorkflow,
    },
    storage,
    observability,
    server: {
      port: Number(process.env.PORT) || 4111,
      host: "0.0.0.0",
      middleware: [customMiddleware],
      apiRoutes: [
        registerApiRoute("/chat/:agentId", {
          method: "POST",
          handler: async (c: any) => {
            try {
              const mastra = c.get("mastra");
              const agentId = c.req.param("agentId");
              const body = await c.req.json();

              const agent = mastra.getAgent(agentId) as Agent;
              if (!agent) return c.json({ error: "Agent not found" }, 404);

              // Handle tool approval/decline responses.
              // The frontend sends { approveRunId, approved } when the user
              // responds to a tool-approval-request.
              if (body.approveRunId) {
                const result = body.approved
                  ? await agent.approveToolCall({ runId: body.approveRunId })
                  : await agent.declineToolCall({ runId: body.approveRunId });

                return createUIMessageStreamResponse({
                  stream: fixApprovalStream(
                    toAISdkStream(result, { from: "agent" }),
                  ),
                });
              }

              // Normal chat message flow
              const lastMsg = Array.isArray(body.messages) ? body.messages.at(-1) : null;
              const text = lastMsg?.parts
                ? lastMsg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
                : typeof lastMsg?.content === "string" ? lastMsg.content
                : typeof body.messages === "string" ? body.messages : "";

              const rid = body.resourceId || "";
              const incomingTid = body.threadId || body.id;

              // The frontend sends the conversation UUID as threadId, but Mastra
              // Memory uses its own thread ID. Look up the mastra_thread_id from
              // the conversation table so memory/history load from the correct thread.
              let tid: string;
              if (incomingTid) {
                const { getDb, schema } = await import("../lib/db");
                const { eq } = await import("drizzle-orm");
                const db = getDb();
                const rows = await db
                  .select({ mastraThreadId: schema.conversation.mastraThreadId })
                  .from(schema.conversation)
                  .where(eq(schema.conversation.id, incomingTid))
                  .limit(1);
                if (rows[0]?.mastraThreadId) {
                  tid = rows[0].mastraThreadId;
                } else {
                  // No mapping — create a Mastra thread and persist the mapping
                  const memory = await agent.getMemory();
                  const thread = await memory!.createThread({ resourceId: rid });
                  tid = thread.id;
                  const now = new Date();
                  await db.insert(schema.conversation).values({
                    id: incomingTid,
                    userId: rid,
                    orgId: null,
                    mastraThreadId: tid,
                    title: null,
                    createdAt: now,
                    updatedAt: now,
                  });
                }
              } else {
                tid = crypto.randomUUID();
              }

              const rctx = new RequestContext([
                ["threadId", tid],
                ["userId", rid],
              ]);

              const result = await agent.stream(
                [{ role: "user" as const, content: text }],
                {
                  maxSteps: 15,
                  memory: { thread: tid, resource: rid },
                  savePerStep: true,
                  requestContext: rctx,
                }
              );

              return createUIMessageStreamResponse({
                stream: fixApprovalStream(
                  toAISdkStream(result, { from: "agent" }),
                ),
              });
            } catch (err: any) {
              console.error("[chat] Error:", err?.message, err?.stack?.slice(0, 500));
              return c.json({ error: err?.message || "Internal error", stack: err?.stack?.slice(0, 300) }, 500);
            }
          },
        }),
      ],
      ...(process.env.NODE_ENV === "production" || process.env.FOREMAN_MODE === "production"
        ? {
            auth: new MastraAuthClerk({
              publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
              secretKey: process.env.CLERK_SECRET_KEY,
            }),
          }
        : {}),
    },
  });

  return _mastra;
}

// Default export for mastra build
export const mastra = getMastra();
