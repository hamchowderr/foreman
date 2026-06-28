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
import { resolveActiveWorkspace, resolveFromRequest } from "../lib/identity";
import { validateAgentCapabilities } from "../lib/providers";
import { requestUserContext } from "../lib/request-user-context";
import { webhookHandlerWorkflow } from "../workflows/webhook-handler";
import { createDiscoveryAgent } from "./agents/discovery";
import { createExecutionAgent } from "./agents/execution";
import { createForemanAgent } from "./agents/foreman";
import { createHistoryAgent } from "./agents/history";
import { createPreviewBuilderAgent } from "./agents/preview-builder";
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
  const previewBuilderAgent = createPreviewBuilderAgent();
  const supervisorAgent = createSupervisorAgent({
    databaseUrl,
    discoveryAgent,
    executionAgent,
    historyAgent,
  });

  // Prefixes owned by the custom Hono app (src/routes). Only these are routed
  // through `customRoutes.fetch()`. Everything else (Mastra's own /chat,
  // /api/*, /a2a/*, /mcp/*) falls straight through to `next()` WITHOUT touching
  // the request body.
  //
  // Why this matters: a Web `Request` body is a single-read ReadableStream that
  // a `.clone()` does NOT duplicate (clone shares the same underlying stream).
  // The previous fall-through pattern — `customRoutes.fetch(c.req.raw)` on every
  // request, then `next()` on 404 — consumed the POST body, so when Mastra
  // dispatched a registered apiRoute (e.g. POST /chat/:agentId) its own
  // `c.req.raw.clone().json()` read an already-exhausted stream and 500'd
  // *before* the handler ran. Mastra's server.middleware contract is
  // headers/context only — it must not read the body of requests it doesn't own.
  const CUSTOM_ROUTE_PREFIXES = [
    "/conversations",
    "/proposals",
    "/apps",
    "/documents",
    "/stored",
    "/zapier",
    "/oauth",
    "/webhooks",
    "/capabilities",
    "/guardrails",
    "/voice",
    "/api-keys",
    "/channel-links",
    "/workspaces",
    "/automations",
    "/telegram",
    "/slack",
    "/discord",
  ];

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

  // Attach token usage to the final assistant message so the web composer's
  // context-usage gauge can read it client-side via `message.metadata.usage`.
  // (toAISdkStream's messageMetadata hook — runs per UI-stream part.)
  const usageMessageMetadata = ({ part }: { part: any }) => {
    if (part?.type === "finish") {
      const usage = part.totalUsage ?? part.usage;
      if (usage) return { usage };
    }
    return undefined;
  };

  _mastra = new Mastra({
    agents: {
      foreman: foremanAgent,
      discovery: discoveryAgent,
      execution: executionAgent,
      history: historyAgent,
      supervisor: supervisorAgent,
      "preview-builder": previewBuilderAgent,
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
      // Bound concurrency and degrade safely: if the queue is saturated, run the
      // tool synchronously in the agentic loop ('fallback-sync') rather than
      // queueing it behind other work — chat must never stall on a full bg queue.
      globalConcurrency: 10,
      perAgentConcurrency: 5,
      backpressure: "fallback-sync",
      // Hard cap on a single task; the per-tool config can override (background.ts).
      defaultTimeoutMs: 300_000,
      // Reap finished task rows so the table doesn't grow unbounded.
      cleanup: { completedTtlMs: 3_600_000, failedTtlMs: 86_400_000 },
      // Observability for live verification (foreman-7am4) — terminal-state hooks.
      onTaskComplete: (task) => console.log(`[bg-task] ✓ ${task.toolName} (${task.id}) completed`),
      onTaskFailed: (task) =>
        console.error(`[bg-task] ✗ ${task.toolName} (${task.id}) failed: ${task.error?.message}`),
    },
    server: {
      port: Number(process.env.PORT) || 4111,
      host: "0.0.0.0",
      // Inlined so Mastra's own Middleware type contextually types (c, next):
      // @mastra/core vendors its own hono type snapshot, so annotating with a
      // root-`hono` MiddlewareHandler isn't assignable here. Only pre-routes the
      // path prefixes the custom Hono app owns; everything else falls through to
      // Mastra with the request body intact (a Web Request body is single-read —
      // see CUSTOM_ROUTE_PREFIXES above).
      middleware: [
        async (c, next) => {
          const p = c.req.path;
          const owned = CUSTOM_ROUTE_PREFIXES.some(
            (prefix) => p === prefix || p.startsWith(`${prefix}/`),
          );
          if (!owned) {
            await next();
            return;
          }
          const { default: customRoutes } = await import("../routes");
          return customRoutes.fetch(c.req.raw);
        },
      ],
      // Mastra's default custom-route error handler swallows the error silently
      // (returns "Internal Server Error" with no log). This surfaces the real
      // error to the server console so failures are debuggable; the client still
      // gets a generic message (no stack leak).
      onError: (err: any, c: any) => {
        console.error("[server.onError]", err?.message, "\n", err?.stack?.slice(0, 1200));
        return c.json({ error: "Internal Server Error" }, 500);
      },
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

              // Derive the TRUSTED user identity from the request (Bearer token /
              // API key) instead of trusting body.resourceId, which the client
              // supplies and could spoof to act as another user (foreman-tss9). All
              // HTTP callers of /chat authenticate; channels invoke the agent
              // in-process, not via this route. body.resourceId is now ignored.
              const identity = await resolveFromRequest(c.req.raw);
              if (!identity) return c.json({ error: "Unauthorized" }, 401);

              if (body.approveRunId) {
                const result = body.approved
                  ? await agent.approveToolCall({ runId: body.approveRunId })
                  : await agent.declineToolCall({ runId: body.approveRunId });

                return createUIMessageStreamResponse({
                  stream: fixApprovalStream(
                    toAISdkStream(result, { from: "agent", messageMetadata: usageMessageMetadata }),
                  ),
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

              // Forward image attachments (AI SDK v6 `file` parts carrying data
              // URLs) so the vision model can actually see them. Without this the
              // handler would drop everything except text.
              const partsList: any[] = Array.isArray(lastMsg?.parts) ? lastMsg.parts : [];
              const imageParts = partsList.filter(
                (p: any) =>
                  p?.type === "file" &&
                  typeof p.url === "string" &&
                  String(p.mediaType ?? p.contentType ?? "").startsWith("image/"),
              );
              const userContent: any =
                imageParts.length > 0
                  ? [
                      ...imageParts.map((p: any) => {
                        // Split the data URL ourselves and pass raw base64 + the
                        // media type from the URL prefix. Passing the whole data
                        // URL let the AI SDK default the type to image/jpeg, which
                        // Anthropic rejects ("specified image/jpeg but the image
                        // appears to be image/png").
                        const url = String(p.url);
                        const m = url.match(/^data:([^;,]+)(?:;base64)?,(.*)$/s);
                        const mediaType = (
                          m?.[1] ||
                          p.mediaType ||
                          p.contentType ||
                          "image/png"
                        ).trim();
                        const image = m ? m[2] : url;
                        return { type: "image" as const, image, mediaType };
                      }),
                      ...(text ? [{ type: "text" as const, text }] : []),
                    ]
                  : text;

              // Trusted: comes from the validated token/key, not the request body.
              const rid = identity.userId;
              const incomingTid = body.threadId || body.id;

              console.log(
                `[chat] request agentId=${agentId} incomingTid=${incomingTid} rid=${rid || "(empty)"}`,
              );

              // The resource the agent runs under (Mastra working memory +
              // resource-scoped semantic recall are keyed on it). Defaults to the
              // sender; for a teammate continuing a shared chat it's overridden to
              // the THREAD OWNER below so the thread's context stays coherent
              // (foreman-whkr). `attribution` prefixes a teammate's message so their
              // authorship is visible in the shared thread.
              let runResource = rid;
              let attribution: string | null = null;

              // Look up mastra_thread_id from the conversation table so memory loads correctly.
              let tid: string;
              if (incomingTid) {
                const { getSupabase } = await import("../lib/db");
                const supabase = getSupabase();
                const { data: conv } = await supabase
                  .from("conversation")
                  .select("mastra_thread_id, user_id, workspace_id, visibility")
                  .eq("id", incomingTid)
                  .limit(1)
                  .maybeSingle();

                if (conv?.mastra_thread_id) {
                  tid = conv.mastra_thread_id;

                  // Collaborative writing (foreman-whkr): if the sender is NOT the
                  // chat's owner, allow the write only when the chat is shared to the
                  // workspace AND the sender is a member — otherwise forbid. Run the
                  // agent under the owner's resourceId (thread continuity) and tag the
                  // teammate's message with their name so authorship is visible.
                  const ownerId = conv.user_id as string | null;
                  if (ownerId && rid && ownerId !== rid) {
                    const member =
                      conv.visibility === "workspace" && conv.workspace_id
                        ? (
                            await supabase
                              .from("workspace_members")
                              .select("workspace_member_id")
                              .eq("workspace_id", conv.workspace_id)
                              .eq("workspace_member_id", rid)
                              .maybeSingle()
                          ).data != null
                        : false;
                    if (!member) {
                      console.warn(
                        `[chat] forbidden write: rid=${rid} is not owner/member of conv=${incomingTid}`,
                      );
                      return c.json({ error: "Forbidden" }, 403);
                    }
                    runResource = ownerId;
                    const { data: sender } = await supabase
                      .from("user")
                      .select("name, email")
                      .eq("id", rid)
                      .maybeSingle();
                    attribution = sender?.name || sender?.email || "A teammate";
                    console.log(
                      `[chat] collaborative write by teammate rid=${rid} on owner=${ownerId} tid=${tid}`,
                    );
                  }

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

              const wsId = rid ? await resolveActiveWorkspace(rid).catch(() => null) : null;
              const ctxEntries: Array<[string, string]> = [
                ["threadId", tid],
                ["userId", rid],
              ];
              if (wsId) ctxEntries.push(["workspaceId", wsId]);
              const rctx = new RequestContext(ctxEntries);

              // Per-request model override (the composer's model selector sends
              // `model`). Allowlisted to Foreman-supported Anthropic models so a
              // bad/cross-provider value can't break prompt/tool cache-control or
              // route to an unknown model. Falls back to the agent's default.
              const ALLOWED_CHAT_MODELS = new Set([
                "anthropic/claude-sonnet-4-6",
                "anthropic/claude-opus-4-6",
                "anthropic/claude-haiku-4-5-20251001",
              ]);
              const requestedModel =
                typeof body.model === "string" && ALLOWED_CHAT_MODELS.has(body.model)
                  ? body.model
                  : undefined;
              if (body.model && !requestedModel) {
                console.warn(`[chat] ignoring unsupported model "${body.model}"`);
              }

              // Tag a teammate's message with their name so the shared thread shows
              // who said what (foreman-whkr). Text-only is the common case; with
              // image parts, prepend a label part.
              let finalUserContent = userContent;
              if (attribution) {
                if (typeof finalUserContent === "string") {
                  finalUserContent = `${attribution}: ${finalUserContent}`;
                } else if (Array.isArray(finalUserContent)) {
                  finalUserContent = [
                    { type: "text" as const, text: `${attribution}:` },
                    ...finalUserContent,
                  ];
                }
              }

              // streamUntilIdle (not stream): when a tool dispatches as a background
              // task (foreman-7am4), keep the SSE open and re-enter the agentic loop
              // on completion so the result folds into the SAME response instead of
              // landing in next-turn memory. With no background task it behaves like
              // stream() — closes as soon as the turn ends (and falls back to stream()
              // entirely if the agent had no memory). maxIdleMs caps the between-turn
              // wait. Same options + same MastraModelOutput, so toAISdkStream is unchanged.
              const result = await requestUserContext.run({ userId: rid }, () =>
                agent.streamUntilIdle([{ role: "user" as const, content: finalUserContent }], {
                  stopWhen: stepCountIs(15),
                  memory: { thread: tid, resource: runResource },
                  savePerStep: true,
                  requestContext: rctx,
                  maxIdleMs: 120_000,
                  ...(requestedModel ? { model: requestedModel } : {}),
                }),
              );

              return createUIMessageStreamResponse({
                stream: fixApprovalStream(
                  toAISdkStream(result, { from: "agent", messageMetadata: usageMessageMetadata }),
                ),
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
