import { Hono } from "hono";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { MODELS, buildSystemPrompt } from "@/mastra/agents/foreman";
import { createChunkTransformer } from "@/lib/stream/transformer";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { desc, eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";
import { contentSchema, validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const titleSchema = z.object({
  title: z.string().max(80),
});

const conversations = new Hono<AppEnv>();

// All routes require auth
conversations.use("/*", authMiddleware);

// POST / — create conversation
conversations.post("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();
  const mastra = await getMastra();

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
  const mastra = await getMastra();
  const memory = await mastra.getAgent("foreman").getMemory();
  let messages: Array<{ id: string; role: string; content: string; created_at: string }> = [];

  if (conv.mastraThreadId && memory) {
    const recalled = await memory.recall({
      threadId: conv.mastraThreadId,
    });
    messages = recalled.messages.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "agent" : m.role,
      content: typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content?.parts)
          ? m.content.parts
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("")
          : JSON.stringify(m.content),
      created_at: m.createdAt instanceof Date
        ? m.createdAt.toISOString()
        : String(m.createdAt ?? ""),
    }));
  }

  return c.json({
    conversation: {
      id: conv.id,
      mastra_thread_id: conv.mastraThreadId,
      title: conv.title,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    },
    messages,
  });
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
  const mastra = await getMastra();
  const agent = mastra.getAgent("foreman");

  const rctx = new RequestContext([["userId", userId]]);

  const result = await agent.stream(
    [{ role: "user" as const, content: userContent }],
    {
      requestContext: rctx,
      ...(dynamicPrompt ? { instructions: dynamicPrompt } : {}),
      memory: conv.mastraThreadId
        ? { thread: conv.mastraThreadId, resource: userId }
        : undefined,
      savePerStep: true,
      // Use fast model for initial tool discovery steps, default for reasoning
      prepareStep: async ({ stepNumber }) => {
        if (stepNumber <= 2) {
          return { model: MODELS.fast };
        }
        return {};
      },
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
          // We only need to handle title generation and conversation metadata updates.
          if (chunk.type === "done" && accumulatedText) {
            // Generate conversation title from first exchange if not set
            if (!conv.title && accumulatedText.length > 0) {
              let title = userContent.slice(0, 60);
              try {
                const titleResult = await agent.generate(
                  `Generate a 3-5 word title for this conversation. The user said: "${userContent}". The assistant replied: "${accumulatedText.slice(0, 200)}".`,
                  {
                    model: MODELS.fast,
                    structuredOutput: { schema: titleSchema },
                  }
                );
                const generated = titleResult.object?.title?.trim();
                if (generated && generated.length > 0) {
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
