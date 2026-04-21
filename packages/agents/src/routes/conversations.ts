import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { MODELS, buildSystemPrompt } from "@/mastra/agents/foreman";
import { createChunkTransformer } from "@/lib/stream/transformer";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { desc, eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";
import { toAISdkStream } from "@mastra/ai-sdk";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { createUIMessageStreamResponse } from "ai";
import { contentSchema, validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const conversations = new Hono<AppEnv>();

// All routes require auth
conversations.use("/*", authMiddleware);

// POST / — create conversation
conversations.post("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();
  const mastra = getMastra();

  // Create a Mastra thread for memory
  const memory = await mastra.getAgent("foreman").getMemory();
  const thread = await memory!.createThread({
    resourceId: userId,
  });

  // Accept client-provided id, or generate one
  let body: any = {};
  try { body = await c.req.json(); } catch {}
  const id = body.id || crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.conversation).values({
    id,
    userId,
    orgId: orgId ?? null,
    mastraThreadId: thread.id,
    title: null,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      id,
      mastra_thread_id: thread.id,
      title: null,
      created_at: now.toISOString(),
    },
    201
  );
});

// GET / — list conversations
conversations.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();

  // When orgId is set, show org conversations; otherwise show personal (orgId IS NULL)
  const whereClause = orgId
    ? and(eq(schema.conversation.userId, userId), eq(schema.conversation.orgId, orgId))
    : eq(schema.conversation.userId, userId);

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(whereClause)
    .orderBy(desc(schema.conversation.updatedAt));

  return c.json(
    rows.map((conv) => ({
      id: conv.id,
      mastra_thread_id: conv.mastraThreadId,
      title: conv.title,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    }))
  );
});

// GET /:id — get conversation with messages
conversations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid conversation id" }, 400);
  }
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.userId, userId)
      )
    )
    .limit(1);

  const conv = rows[0];
  if (!conv) {
    return c.json({ error: "Not found" }, 404);
  }

  // Load messages from Mastra Memory thread (single source of truth)
  const mastra = getMastra();
  const memory = await mastra.getAgent("foreman").getMemory();
  let messages: unknown[] = [];

  if (conv.mastraThreadId && memory) {
    const recalled = await memory.recall({
      threadId: conv.mastraThreadId,
      perPage: false, // Return all messages, no pagination
    });

    // Convert MastraDBMessage[] to AI SDK UIMessage format using the official converter.
    // This preserves text parts, tool calls, tool results, and all message metadata.
    messages = toAISdkV5Messages(recalled.messages);
  }

  // Also fetch the thread to get Memory-managed title
  let memoryTitle = conv.title;
  if (conv.mastraThreadId && memory) {
    try {
      const thread = await memory.getThreadById({ threadId: conv.mastraThreadId });
      if (thread?.title) memoryTitle = thread.title;
    } catch {
      // Fall back to conversation table title
    }
  }

  return c.json({
    conversation: {
      id: conv.id,
      mastra_thread_id: conv.mastraThreadId,
      title: memoryTitle,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    },
    messages,
  });
});

// PATCH /:id — update conversation (title, etc.)
conversations.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid conversation id" }, 400);
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(and(eq(schema.conversation.id, id), eq(schema.conversation.userId, userId)))
    .limit(1);

  if (!rows[0]) return c.json({ error: "Not found" }, 404);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
  if (!title) return c.json({ error: "title is required" }, 400);

  await db
    .update(schema.conversation)
    .set({ title, updatedAt: new Date() })
    .where(eq(schema.conversation.id, id));

  return c.json({ id, title });
});

// POST /:id/messages — stream agent response via SSE
conversations.post("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = validateParam(c.req.param("id"), "id");
  if (!conversationId) {
    return c.json({ error: "Invalid conversation id" }, 400);
  }
  const db = getDb();

  // Verify conversation ownership
  const convRows = await db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, conversationId),
        eq(schema.conversation.userId, userId)
      )
    )
    .limit(1);

  const conv = convRows[0];
  if (!conv) {
    return c.json({ error: "Not found" }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const contentResult = contentSchema.safeParse(body.content);
  if (!contentResult.success) {
    return c.json({ error: "content is required (string, max 50000 chars)" }, 400);
  }
  const userContent = contentResult.data;

  // Build dynamic system prompt if client sends context
  const dynamicPrompt = body.context
    ? buildSystemPrompt(body.context)
    : undefined;

  // Stream from Mastra agent — memory handles message persistence and history
  // We only send the current user message; Mastra Memory loads prior context
  // from the thread automatically via the `memory` option.
  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const rctx = new RequestContext([
    ["userId", userId],
    ...(conv.mastraThreadId ? [["threadId", conv.mastraThreadId] as [string, string]] : []),
  ]);

  const result = await agent.stream(
    [{ role: "user" as const, content: userContent }],
    {
      requestContext: rctx,
      ...(dynamicPrompt ? { instructions: dynamicPrompt } : {}),
      memory: conv.mastraThreadId
        ? { thread: conv.mastraThreadId, resource: userId }
        : undefined,
      maxSteps: 15,
      savePerStep: true,
    }
  );

  // Set up the SSE transform pipeline
  const transformer = createChunkTransformer(conversationId);
  let accumulatedText = "";

  const sseStream = new ReadableStream({
    async start(controller) {
      const fullStream = result.fullStream;
      const transformedStream = new ReadableStream({
        async start(ctrl) {
          const reader = fullStream.getReader();
          const writer = transformer.writable.getWriter();
          const tReader = transformer.readable.getReader();

          // Pipe fullStream -> transformer input
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  writer.close();
                  break;
                }
                await writer.write(value);
              }
            } catch {
              writer.close();
            }
          })();

          // Read transformer output
          try {
            while (true) {
              const { done, value } = await tReader.read();
              if (done) break;
              ctrl.enqueue(value);
            }
          } finally {
            ctrl.close();
          }
        },
      });
      const reader = transformedStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as AppChunk;

          // Accumulate agent text for persistence
          if (chunk.type === "text-delta") {
            accumulatedText += chunk.text;
          }

          controller.enqueue(encodeSSE(chunk));

          // On done, Mastra Memory has already persisted messages to the thread.
          // Title generation is handled by Memory's generateTitle option.
          // Sync the Memory-managed title back to our conversation table.
          if (chunk.type === "done") {
            try {
              const memory = await agent.getMemory();
              const thread = memory ? await memory.getThreadById({ threadId: conv.mastraThreadId! }) : null;
              const title = thread?.title || conv.title;
              await db
                .update(schema.conversation)
                .set({ title, updatedAt: new Date() })
                .where(eq(schema.conversation.id, conversationId));

              if (title && title !== conv.title) {
                const titleChunk: AppChunk = {
                  type: "title-updated",
                  title,
                };
                controller.enqueue(encodeSSE(titleChunk));
              }
            } catch {
              await db
                .update(schema.conversation)
                .set({ updatedAt: new Date() })
                .where(eq(schema.conversation.id, conversationId));
            }
          }
        }
      } catch (err) {
        const errorChunk: AppChunk = {
          type: "error",
          code: "STREAM_ERROR",
          message: err instanceof Error ? err.message : String(err),
        };
        controller.enqueue(encodeSSE(errorChunk));
      } finally {
        controller.close();
      }
    },
  });

  const headers = sseHeaders();
  return new Response(sseStream, { headers });
});

// POST /chat — UIMessageStream-compatible endpoint for AI SDK useChat
// Creates conversation if needed, streams response in AI SDK format
conversations.post("/chat", async (c) => {
  const userId = c.get("userId");
  const db = getDb();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Extract user message from AI SDK format
  const lastMessage = body.message || body.messages?.at(-1);
  let userContent = "";
  if (lastMessage?.parts) {
    userContent = lastMessage.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  } else if (typeof lastMessage?.content === "string") {
    userContent = lastMessage.content;
  }

  if (!userContent) {
    return c.json({ error: "No message content" }, 400);
  }

  try {
    const mastra = getMastra();
    const agent = mastra.getAgent("foreman");
    const memory = await agent.getMemory();

    // Check if conversation exists (reuse thread for continuity)
    const clientId = body.id;
    let convId: string;
    let threadId: string;

    if (clientId) {
      const existing = await db
        .select()
        .from(schema.conversation)
        .where(
          and(
            eq(schema.conversation.id, clientId),
            eq(schema.conversation.userId, userId)
          )
        )
        .limit(1);

      if (existing[0]?.mastraThreadId) {
        // Reuse existing conversation and thread
        convId = existing[0].id;
        threadId = existing[0].mastraThreadId;
      } else {
        // Create new conversation with client-provided ID
        const thread = await memory!.createThread({ resourceId: userId });
        convId = clientId;
        threadId = thread.id;
        const now = new Date();
        await db.insert(schema.conversation).values({
          id: convId,
          userId,
          orgId: null,
          mastraThreadId: threadId,
          title: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      // No client ID — create fresh conversation
      const thread = await memory!.createThread({ resourceId: userId });
      convId = crypto.randomUUID();
      threadId = thread.id;
      const now = new Date();
      await db.insert(schema.conversation).values({
        id: convId,
        userId,
        orgId: null,
        mastraThreadId: threadId,
        title: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const rctx = new RequestContext([
      ["userId", userId],
      ["threadId", threadId],
    ]);

    const result = await agent.stream(
      [{ role: "user" as const, content: userContent }],
      {
        requestContext: rctx,
        memory: { thread: threadId, resource: userId },
        maxSteps: 15,
        savePerStep: true,
      }
    );

    // Title generation is handled by Mastra Memory's generateTitle option.
    // After the stream completes, sync the Memory-generated title back to our
    // conversation table so the sidebar can show it.
    result.fullStream
      .pipeTo(new WritableStream({ close: async () => {
        try {
          const memory = await agent.getMemory();
          if (memory) {
            const thread = await memory.getThreadById({ threadId });
            // Use Memory-generated title, or fall back to first user message
            const title = thread?.title || userContent.slice(0, 80) || "New conversation";
            await db
              .update(schema.conversation)
              .set({ title, updatedAt: new Date() })
              .where(eq(schema.conversation.id, convId));
          }
        } catch {}
      }}))
      .catch(() => {}); // Fire-and-forget, don't block the response

    // Convert Mastra stream to AI SDK UIMessageStream format
    return createUIMessageStreamResponse({
      stream: toAISdkStream(result, { from: "agent" }),
    });
  } catch (err) {
    console.error("[chat] Error:", err);
    return c.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

export default conversations;
