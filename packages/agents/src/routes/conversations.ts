import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { desc, eq, and } from "drizzle-orm";
import { validateParam } from "@/lib/validation";
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

  const memory = await mastra.getAgent("foreman").getMemory();
  const thread = await memory!.createThread({ resourceId: userId });

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

  return c.json({ id, mastra_thread_id: thread.id, title: null, created_at: now.toISOString() }, 201);
});

// GET / — list conversations
conversations.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();

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
  if (!id) return c.json({ error: "Invalid conversation id" }, 400);
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(and(eq(schema.conversation.id, id), eq(schema.conversation.userId, userId)))
    .limit(1);

  const conv = rows[0];
  if (!conv) return c.json({ error: "Not found" }, 404);

  // Load messages from Mastra Memory (single source of truth)
  const mastra = getMastra();
  const memory = await mastra.getAgent("foreman").getMemory();
  let messages: unknown[] = [];

  if (conv.mastraThreadId && memory) {
    const recalled = await memory.recall({
      threadId: conv.mastraThreadId,
      perPage: false,
    });
    messages = toAISdkV5Messages(recalled.messages);
  }

  // Sync title from Memory thread
  let title = conv.title;
  if (conv.mastraThreadId && memory) {
    try {
      const thread = await memory.getThreadById({ threadId: conv.mastraThreadId });
      if (thread?.title) title = thread.title;
    } catch {}
  }

  return c.json({
    conversation: { id: conv.id, mastra_thread_id: conv.mastraThreadId, title, created_at: conv.createdAt.toISOString(), updated_at: conv.updatedAt.toISOString() },
    messages,
  });
});

// PATCH /:id — update conversation title
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

  await db.update(schema.conversation).set({ title, updatedAt: new Date() }).where(eq(schema.conversation.id, id));
  return c.json({ id, title });
});

// DELETE /:id — delete conversation
conversations.delete("/:id", async (c) => {
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

  await db.delete(schema.conversation).where(eq(schema.conversation.id, id));
  return c.json({ success: true });
});

// Chat streaming is handled by Mastra's built-in chatRoute at /chat/:agentId
// (registered in mastra/index.ts). It handles streaming, tool approval/resume,
// memory persistence, and title generation natively.

export default conversations;
