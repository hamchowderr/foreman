import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { createChunkTransformer } from "@/lib/stream/transformer";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { desc, eq, and, asc } from "drizzle-orm";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const conversations = new Hono<AppEnv>();

// All routes require auth
conversations.use("/*", authMiddleware);

// POST / — create conversation
conversations.post("/", async (c) => {
  const userId = c.get("userId");
  const db = getDb();
  const mastra = getMastra();

  // Create a Mastra thread for memory
  const memory = await mastra.getAgent("foreman").getMemory();
  const thread = await memory!.createThread({
    resourceId: userId,
  });

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.conversation).values({
    id,
    userId,
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
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(eq(schema.conversation.userId, userId))
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
  const id = c.req.param("id");
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

  const messages = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, id))
    .orderBy(asc(schema.message.createdAt));

  return c.json({
    conversation: {
      id: conv.id,
      mastra_thread_id: conv.mastraThreadId,
      title: conv.title,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: JSON.parse(m.content),
      created_at: m.createdAt.toISOString(),
    })),
  });
});

// POST /:id/messages — stream agent response via SSE
conversations.post("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");
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

  const body = await c.req.json();
  const userContent: string = body.content;
  if (!userContent || typeof userContent !== "string") {
    return c.json({ error: "content is required" }, 400);
  }

  // Persist user message
  const userMessageId = crypto.randomUUID();
  await db.insert(schema.message).values({
    id: userMessageId,
    conversationId,
    role: "user",
    content: JSON.stringify(userContent),
    createdAt: new Date(),
  });

  // Load conversation history for context
  const historyRows = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, conversationId))
    .orderBy(asc(schema.message.createdAt));

  const messages = historyRows.map((m) => ({
    role: (m.role === "agent" ? "assistant" : m.role) as
      | "user"
      | "assistant"
      | "system",
    content: JSON.parse(m.content) as string,
  }));

  // Stream from Mastra agent
  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const result = await agent.stream(messages, {
    memory: conv.mastraThreadId
      ? { thread: conv.mastraThreadId, resource: userId }
      : undefined,
  });

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

          // On done, persist agent message
          if (chunk.type === "done" && accumulatedText) {
            const agentMessageId = crypto.randomUUID();
            await db.insert(schema.message).values({
              id: agentMessageId,
              conversationId,
              role: "assistant",
              content: JSON.stringify(accumulatedText),
              createdAt: new Date(),
            });

            // Generate conversation title from first exchange if not set
            if (!conv.title && accumulatedText.length > 0) {
              let title = userContent.slice(0, 60);
              try {
                const titleResult = await agent.generate(
                  `Generate a 3-5 word title for this conversation. The user said: "${userContent}". The assistant replied: "${accumulatedText.slice(0, 200)}". Reply with ONLY the title, no quotes or punctuation.`,
                  {
                    memory: conv.mastraThreadId
                      ? { thread: conv.mastraThreadId, resource: userId }
                      : undefined,
                  }
                );
                const generated = titleResult.text?.trim();
                if (
                  generated &&
                  generated.length > 0 &&
                  generated.length <= 80
                ) {
                  title = generated;
                }
              } catch {
                // Fall back to truncated user content
              }

              await db
                .update(schema.conversation)
                .set({ title, updatedAt: new Date() })
                .where(eq(schema.conversation.id, conversationId));

              // Notify client of the new title
              const titleChunk: AppChunk = {
                type: "title-updated",
                title,
              };
              controller.enqueue(encodeSSE(titleChunk));
            } else {
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

export default conversations;
