import { enableFileLogging } from "../lib/file-logger";

enableFileLogging();

import path from "node:path";
import { fileURLToPath } from "node:url";
import { toAISdkStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core";
import type { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { registerApiRoute } from "@mastra/core/server";
import { MastraCompositeStore } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraEditor } from "@mastra/editor";
import { PinoLogger } from "@mastra/loggers";
import { ConsoleExporter, DefaultExporter, Observability } from "@mastra/observability";
import { PostgresStore } from "@mastra/pg";
import { createUIMessageStreamResponse, stepCountIs } from "ai";
import type { MiddlewareHandler } from "hono";
import { validateAgentCapabilities } from "../lib/providers";
import { requestUserContext } from "../lib/request-user-context";
import { webhookHandlerWorkflow } from "../workflows/webhook-handler";
import { createDiscoveryAgent } from "./agents/discovery";
import { createExecutionAgent } from "./agents/execution";
import { createForemanAgent } from "./agents/foreman";
import { createHistoryAgent } from "./agents/history";
import { createSupervisorAgent } from "./agents/supervisor";

validateAgentCapabilities();

let _mastra: Mastra | undefined;

// Lazy resolution of the Mastra instance. NOTE: we tried hoisting `new Mastra({...})`
// to module level so the deployer's AST analyzer could extract `bundler: { sourcemap: true }`
// (which currently silently no-ops for indirect/wrapped construction). It worked for
// `mastra build` but broke `mastra dev`'s named-export resolution for `getMastra` —
// dev's bundler treats the file as having only the `mastra` const exported. Until
// upstream sorts that out, keeping construction inside `getMastra()` is the way.
export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  // Postgres handles every storage domain except observability — Mastra's
  // observability domain (traces, metrics, logs, scores, feedback) needs an
  // OLAP-capable backend. Per Mastra docs, Postgres/LibSQL are NOT supported
  // for observability; DuckDB is the recommended local-dev backend (ClickHouse
  // for production). Composite store routes the observability domain to
  // DuckDB while leaving the rest on Postgres.
  // Docs: https://mastra.ai/docs/observability/metrics/overview
  const storage = new MastraCompositeStore({
    id: "foreman-storage",
    default: new PostgresStore({
      id: "foreman-storage-pg",
      connectionString: databaseUrl,
    }),
    domains: {
      observability: new DuckDBStore({
        // Resolve relative to THIS file's location, not process.cwd().
        // `mastra dev` runs the bundled entry from .mastra/output/index.mjs
        // with cwd set to src/mastra/public/ — using cwd would put the file
        // there and (a) fail to find its dir on first boot, (b) lock the
        // bundled-assets dir for the next build. import.meta.url is stable:
        // - source path `src/mastra/index.ts` → ../../data/mastra.duckdb
        //   under packages/agents/data/
        // - bundled path `.mastra/output/index.mjs` → same destination
        path:
          process.env.DUCKDB_PATH ??
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            "..",
            "..",
            "data",
            "mastra.duckdb",
          ),
      }).observability,
    },
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

  // Observability is always on so the Mastra Studio Observability tab works.
  // OTEL_ENABLED=true additionally enables the OTEL Console exporter for local
  // span dumping; production typically only wants the DefaultExporter.
  // The `logging` block forwards PinoLogger calls into the observability log
  // store (DuckDB) so Studio's Logs tab is populated by application logger
  // calls, not just Mastra-internal traces.
  // Docs: https://mastra.ai/docs/observability/logging
  const observability = new Observability({
    configs: {
      default: {
        serviceName: "foreman-agents",
        exporters:
          process.env.OTEL_ENABLED === "true"
            ? [new DefaultExporter(), new ConsoleExporter()]
            : [new DefaultExporter()],
        logging: {
          enabled: true,
          level: (process.env.OBS_LOG_LEVEL as any) ?? "info",
        },
      },
    },
  });

  // PinoLogger is the canonical Mastra logger. With observability configured
  // above, Mastra wraps it so every debug/info/warn/error call is forwarded to
  // both the console AND the observability log store automatically.
  const logger = new PinoLogger({
    name: "foreman",
    level: (process.env.LOG_LEVEL as any) ?? "info",
  });

  const editor = new MastraEditor();

  // Fix the stream format mismatch between @mastra/ai-sdk and the AI SDK v6 protocol.
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
    editor,
    logger,
    // Background tasks must be enabled at the Mastra level for
    // `mastra.backgroundTaskManager` to be defined. With this on, individual
    // tools can opt into background execution via their own `background`
    // config (or per-call via the LLM's `_background` arg), and the
    // /background-tasks/stream SSE endpoint becomes available for monitoring.
    // Docs: https://mastra.ai/docs/streaming/background-tasks
    backgroundTasks: {
      enabled: true,
    },
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
                  stream: fixApprovalStream(toAISdkStream(result, { from: "agent" })),
                });
              }

              const lastMsg = Array.isArray(body.messages) ? body.messages.at(-1) : null;
              const text = lastMsg?.parts
                ? lastMsg.parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join("")
                : typeof lastMsg?.content === "string"
                  ? lastMsg.content
                  : typeof body.messages === "string"
                    ? body.messages
                    : "";

              const rid = body.resourceId || "";
              const incomingTid = body.threadId || body.id;

              console.log(
                `[chat] request agentId=${agentId} incomingTid=${incomingTid} rid=${rid || "(empty)"}`,
              );

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
                      { onConflict: "id" },
                    );
                    if (insertErr) {
                      console.error(
                        `[chat] conversation upsert failed: ${insertErr.message} (code=${insertErr.code})`,
                      );
                    } else {
                      console.log(`[chat] created thread mapping conv=${incomingTid} tid=${tid}`);
                    }
                  } else {
                    // rid empty — userId not yet loaded. Row will be written on next request.
                    console.log(
                      `[chat] rid empty, deferring row insert. Using incomingTid as tid=${tid}`,
                    );
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
                agent.stream([{ role: "user" as const, content: text }], {
                  stopWhen: stepCountIs(15),
                  memory: { thread: tid, resource: rid },
                  savePerStep: true,
                  requestContext: rctx,
                }),
              );

              return createUIMessageStreamResponse({
                stream: fixApprovalStream(toAISdkStream(result, { from: "agent" })),
              });
            } catch (err: any) {
              console.error("[chat] Error:", err?.message, err?.stack?.slice(0, 500));
              return c.json(
                { error: err?.message || "Internal error", stack: err?.stack?.slice(0, 300) },
                500,
              );
            }
          },
        }),
        // Stream every background-task lifecycle event as SSE. Filterable via
        // ?agentId=&runId=&threadId=&resourceId=&taskId= query params. The
        // stream stays open until the client disconnects (AbortController is
        // wired to c.req.raw.signal). Emits an initial snapshot of currently
        // running tasks then forwards live events.
        registerApiRoute("/background-tasks/stream", {
          method: "GET",
          handler: async (c: any) => {
            const m = c.get("mastra");
            const bg = m.backgroundTaskManager;
            if (!bg) {
              return c.json(
                { error: "backgroundTasks is not enabled on this Mastra instance" },
                503,
              );
            }

            const filter: Record<string, string> = {};
            for (const key of ["agentId", "runId", "threadId", "resourceId", "taskId"] as const) {
              const v = c.req.query(key);
              if (typeof v === "string" && v.length > 0) filter[key] = v;
            }

            const controller = new AbortController();
            const upstream: Request = c.req.raw;
            if (upstream.signal) {
              if (upstream.signal.aborted) controller.abort();
              else upstream.signal.addEventListener("abort", () => controller.abort());
            }

            const taskStream = bg.stream({ ...filter, abortSignal: controller.signal });
            const sse = new ReadableStream({
              async start(out) {
                const enc = new TextEncoder();
                try {
                  for await (const chunk of taskStream) {
                    out.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                } catch (err: any) {
                  if (err?.name !== "AbortError") {
                    out.enqueue(
                      enc.encode(
                        `event: error\ndata: ${JSON.stringify({ message: err?.message })}\n\n`,
                      ),
                    );
                  }
                } finally {
                  out.close();
                }
              },
              cancel() {
                controller.abort();
              },
            });

            return new Response(sse, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
              },
            });
          },
        }),
      ],
    },
  });

  return _mastra;
}

// Default export so `mastra build` and friends can pick the instance up via
// the entry file, while interactive callers continue to call `getMastra()`.
export const mastra = getMastra();
