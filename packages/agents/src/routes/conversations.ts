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

// Mastra's generateTitle sometimes wraps the title in markdown (`# ...`,
// `**...**`), prefixes it with a "Title:" label, or returns a whole sentence.
// Normalize to a clean, short display title; return null for blank input so the
// UI falls back to its "New conversation" placeholder.
function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = raw.split("\n")[0].trim();
  t = t
    .replace(/^#+\s*/, "") // markdown heading
    .replace(/^>\s*/, "") // blockquote
    .replace(/^\*+\s*/, "")
    .replace(/\*+$/, "") // bold markers
    .replace(/^title:\s*/i, "") // "Title:" label
    .replace(/^["'“”]+|["'“”]+$/g, "") // wrapping quotes
    .replace(/\*\*/g, "")
    .trim();
  if (!t) return null;
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
}

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

// GET / — list conversations. `?archived=true` returns only archived ones;
// otherwise archived conversations are excluded from the default history.
conversations.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();
  const onlyArchived = c.req.query("archived") === "true";

  let query = supabase.from("conversation").select("*").eq("user_id", userId);
  query = onlyArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data: rows } = await query.order("updated_at", { ascending: false });

  // Surface Mastra's auto-generated thread title in the sidebar when the user
  // hasn't set an explicit one. Batch all of the user's thread titles in a
  // single query (resourceId = userId) rather than one lookup per conversation.
  const { data: threads } = await supabase
    .from("mastra_threads")
    .select("id, title")
    .eq("resourceId", userId);
  const threadTitle = new Map<string, string>((threads ?? []).map((t: any) => [t.id, t.title]));

  return c.json(
    (rows ?? []).map((conv: any) => ({
      id: conv.id,
      mastra_thread_id: conv.mastra_thread_id,
      title: (conv.title?.trim() || cleanTitle(threadTitle.get(conv.mastra_thread_id))) ?? null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      archived_at: conv.archived_at ?? null,
    })),
  );
});

// Pull a short, human-readable excerpt out of a stored message around the match.
// Stored content is JSON text (`{ parts: [...], content: "..." }`); fall back to
// the raw string if it doesn't parse.
function searchSnippet(content: string, q: string): string | null {
  let text = content;
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed?.content === "string") text = parsed.content;
    else if (Array.isArray(parsed?.parts)) {
      text = parsed.parts
        .filter((p: any) => p?.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join(" ");
    }
  } catch {}
  text = text.trim();
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 100);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

// GET /search?q= — search the user's conversations by title and message content.
// One pass: title matches + content matches (scoped to the user via resourceId),
// merged and de-duped by conversation, newest first.
conversations.get("/search", async (c) => {
  const userId = c.get("userId");
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ results: [] });

  const supabase = getSupabase();
  // Escape LIKE wildcards so a literal % or _ in the query isn't treated as one.
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const { data: byTitle } = await supabase
    .from("conversation")
    .select("id, mastra_thread_id, title, created_at, updated_at, archived_at")
    .eq("user_id", userId)
    .ilike("title", like);

  const { data: msgHits } = await supabase
    .from("mastra_messages")
    .select("thread_id, content")
    .eq("resourceId", userId)
    .ilike("content", like)
    .limit(200);

  // First matching message per thread → content snippet.
  const snippetByThread = new Map<string, string | null>();
  for (const m of msgHits ?? []) {
    if (!snippetByThread.has(m.thread_id)) {
      snippetByThread.set(m.thread_id, searchSnippet(m.content, q));
    }
  }

  // The sidebar shows Mastra's generated thread title, so search must cover it
  // too (not just conversation.title + message content). Load the user's thread
  // titles once — used both to match and to display the right title on results.
  const { data: threads } = await supabase
    .from("mastra_threads")
    .select("id, title")
    .eq("resourceId", userId);
  const threadTitle = new Map<string, string>((threads ?? []).map((t: any) => [t.id, t.title]));
  const qLower = q.toLowerCase();
  const titleThreadIds = (threads ?? [])
    .filter((t: any) => typeof t.title === "string" && t.title.toLowerCase().includes(qLower))
    .map((t: any) => t.id);

  // Threads matched by content or by generated title → their conversations.
  const matchedThreadIds = new Set<string>([...snippetByThread.keys(), ...titleThreadIds]);
  let byThread: any[] = [];
  if (matchedThreadIds.size > 0) {
    const { data } = await supabase
      .from("conversation")
      .select("id, mastra_thread_id, title, created_at, updated_at, archived_at")
      .eq("user_id", userId)
      .in("mastra_thread_id", [...matchedThreadIds]);
    byThread = data ?? [];
  }

  const merged = new Map<string, any>();
  for (const conv of byTitle ?? []) merged.set(conv.id, { ...conv, snippet: null });
  for (const conv of byThread) {
    const snippet = snippetByThread.get(conv.mastra_thread_id) ?? null;
    const existing = merged.get(conv.id);
    if (existing) existing.snippet ??= snippet;
    else merged.set(conv.id, { ...conv, snippet });
  }

  const results = [...merged.values()]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 30)
    .map((conv) => ({
      id: conv.id,
      title: (conv.title?.trim() || cleanTitle(threadTitle.get(conv.mastra_thread_id))) ?? null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      archived_at: conv.archived_at ?? null,
      snippet: conv.snippet,
    }));

  return c.json({ results });
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

  // Prefer the user's explicit title (rename); otherwise fall back to Mastra's
  // generated thread title, cleaned. Mirrors the list endpoint's precedence.
  let title: string | null = conv.title?.trim() || null;
  if (!title && conv.mastra_thread_id && memory) {
    try {
      const thread = await memory.getThreadById({ threadId: conv.mastra_thread_id });
      title = cleanTitle(thread?.title);
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

// PATCH /:id — update a conversation's title and/or archived state.
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

  const update: { title?: string; archived_at?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 80);
    if (!title) return c.json({ error: "title cannot be empty" }, 400);
    update.title = title;
  }

  // `archived: true` archives (sets the timestamp); `false` restores it.
  if (typeof body.archived === "boolean") {
    update.archived_at = body.archived ? new Date().toISOString() : null;
  }

  if (update.title === undefined && update.archived_at === undefined) {
    return c.json({ error: "title or archived is required" }, 400);
  }

  await supabase.from("conversation").update(update).eq("id", id);

  return c.json({
    id,
    ...(update.title !== undefined ? { title: update.title } : {}),
    ...(typeof body.archived === "boolean" ? { archived: body.archived } : {}),
  });
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
