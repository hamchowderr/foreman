import { enableFileLogging } from "../lib/file-logger";
enableFileLogging();

import { Mastra } from "@mastra/core";
import { MastraEditor } from "@mastra/editor";
import { PostgresStore } from "@mastra/pg";
import { Observability, ConsoleExporter, DefaultExporter } from "@mastra/observability";
import { toAISdkStream } from "@mastra/ai-sdk";
import { registerApiRoute } from "@mastra/core/server";
import { RequestContext } from "@mastra/core/request-context";
import { createUIMessageStreamResponse, stepCountIs } from "ai";
import type { Agent } from "@mastra/core/agent";
import { createForemanAgent } from "./agents/foreman";
import { createDiscoveryAgent } from "./agents/discovery";
import { createExecutionAgent } from "./agents/execution";
import { createHistoryAgent } from "./agents/history";
import { createSupervisorAgent } from "./agents/supervisor";
import { webhookHandlerWorkflow } from "../workflows/webhook-handler";
import { validateAgentCapabilities } from "../lib/providers";
import { requestUserContext } from "../lib/request-user-context";
import type { MiddlewareHandler } from "hono";

validateAgentCapabilities();

let _mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  const storage = new PostgresStore({
    id: "foreman-storage",
    connectionString: databaseUrl,
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
   */
  function fixApprovalStream(stream: ReadableStream): ReadableStream {
    return stream.pipeThrough(
      new TransformStream({
        transform(chunk: any, controller) {
          if (chunk.type === "data-tool-call-approval") {
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

              const lastMsg = Array.isArray(body.messages) ? body.messages.at(-1) : null;
              const text = lastMsg?.parts
                ? lastMsg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
                : typeof lastMsg?.content === "string" ? lastMsg.content
                : typeof body.messages === "string" ? body.messages : "";

              const rid = body.resourceId || "";
              const incomingTid = body.threadId || body.id;

              console.log(`[chat] request agentId=${agentId} incomingTid=${incomingTid} rid=${rid || "(empty)"}`);

              // Look up mastra_thread_id from the conversation table so memory loads correctly.
              let tid: string;
              if (incomingTid) {
                const { getSupabase } = await import("../lib/db");
                const supabase = getSupabase();
                const { data: conv } = await supabase
                  .from("conversation")
                  .select("mastra_thread_id")
                  .eq("id", incomingTid)
                  .limit(1)
                  .maybeSingle();

                if (conv?.mastra_thread_id) {
                  tid = conv.mastra_thread_id;
                  console.log(`[chat] found thread tid=${tid}`);
                } else {
                  // No DB row yet — use incomingTid as the Mastra thread ID directly so the
                  // same thread is used across all messages for this chat, even if the DB row
                  // hasn't been written yet (e.g. userId not loaded on first message).
                  // Mastra creates the thread on first use if it doesn't exist.
                  tid = incomingTid;
                  if (rid) {
                    // userId is available — persist the mapping now
                    const now = new Date().toISOString();
                    const { error: insertErr } = await supabase.from("conversation").upsert(
                      {
                        id: incomingTid,
                        user_id: rid,
                        mastra_thread_id: tid,
                        title: null,
                        created_at: now,
                        updated_at: now,
                      },
                      { onConflict: "id" }
                    );
                    if (insertErr) {
                      console.error(`[chat] conversation upsert failed: ${insertErr.message} (code=${insertErr.code})`);
                    } else {
                      console.log(`[chat] created thread mapping conv=${incomingTid} tid=${tid}`);
                    }
                  } else {
                    // rid empty — userId not yet loaded. Row will be written on next request.
                    console.log(`[chat] rid empty, deferring row insert. Using incomingTid as tid=${tid}`);
                  }
                }
              } else {
                tid = crypto.randomUUID();
                console.log(`[chat] no incomingTid, using random tid=${tid}`);
              }

              const rctx = new RequestContext([
                ["threadId", tid],
                ["userId", rid],
              ]);

              const result = await requestUserContext.run({ userId: rid }, () =>
                agent.stream(
                  [{ role: "user" as const, content: text }],
                  {
                    stopWhen: stepCountIs(15),
                    memory: { thread: tid, resource: rid },
                    savePerStep: true,
                    requestContext: rctx,
                  }
                )
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
    },
  });

  return _mastra;
}

// Default export for mastra build
export const mastra = getMastra();
