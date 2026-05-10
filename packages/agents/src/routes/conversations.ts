import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { Hono } from "hono";
import { getSupabase } from "@/lib/db";
import { validateParam } from "@/lib/validation";
import { getMastra } from "@/mastra";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const conversations = new Hono<AppEnv>();

// All routes require auth
conversations.use("/*", authMiddleware);

// POST / — create conversation
conversations.post("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}
  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();

  // Check if conversation already exists (idempotent — frontend may retry)
  const { data: existing } = await supabase
    .from("conversation")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing) return c.json({ id, mastra_thread_id: id, title: null, created_at: now }, 200);

  // Use chatId as the Mastra threadId so the frontend's threadId matches
  const mastra = getMastra();
  const memory = await mastra.getAgent("foreman").getMemory();
  if (memory) {
    try {
      await memory.createThread({ threadId: id, resourceId: userId });
    } catch {}
  }

  await supabase.from("conversation").insert({
    id,
    user_id: userId,
    mastra_thread_id: id,
    title: null,
    created_at: now,
    updated_at: now,
  });

  return c.json({ id, mastra_thread_id: id, title: null, created_at: now }, 201);
});

// GET / — list conversations
conversations.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  const { data: rows } = await supabase
    .from("conversation")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return c.json(
    (rows ?? []).map((conv: any) => ({
      id: conv.id,
      mastra_thread_id: conv.mastra_thread_id,
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    })),
  );
});

// GET /:id — get conversation with messages
conversations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid conversation id" }, 400);
  const supabase = getSupabase();

  const { data: conv } = await supabase
    .from("conversation")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!conv) return c.json({ error: "Not found" }, 404);

  // Load messages from Mastra Memory (single source of truth)
  const mastra = getMastra();
  const memory = await mastra.getAgent("foreman").getMemory();
  let messages: unknown[] = [];

  if (conv.mastra_thread_id && memory) {
    const recalled = await memory.recall({
      threadId: conv.mastra_thread_id,
      perPage: false,
    });
    messages = toAISdkV5Messages(recalled.messages);
  }

  // Sync title from Memory thread
  let title = conv.title;
  if (conv.mastra_thread_id && memory) {
    try {
      const thread = await memory.getThreadById({ threadId: conv.mastra_thread_id });
      if (thread?.title) title = thread.title;
    } catch {}
  }

  return c.json({
    conversation: {
      id: conv.id,
      mastra_thread_id: conv.mastra_thread_id,
      title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    },
    messages,
  });
});

// PATCH /:id — update conversation title
conversations.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid conversation id" }, 400);
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("conversation")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!existing) return c.json({ error: "Not found" }, 404);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
  if (!title) return c.json({ error: "title is required" }, 400);

  await supabase
    .from("conversation")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  return c.json({ id, title });
});

// DELETE /:id — delete conversation
conversations.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid conversation id" }, 400);
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("conversation")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await supabase.from("conversation").delete().eq("id", id);
  return c.json({ success: true });
});

export default conversations;
