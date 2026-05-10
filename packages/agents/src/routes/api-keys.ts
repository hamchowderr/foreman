import { Hono } from "hono";
import { getSupabase } from "@/lib/db";
import { createApiKey } from "@/lib/identity";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const apiKeys = new Hono<AppEnv>();

apiKeys.use("/*", authMiddleware);

// GET / — list user's API keys (never expose key_hash)
apiKeys.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("api_key")
    .select("id, name, scopes, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: "Failed to list API keys" }, 500);
  return c.json({ keys: data ?? [] });
});

// POST / — create a new API key; returns raw key one time only
apiKeys.post("/", async (c) => {
  const userId = c.get("userId");
  let body: { name?: string; scopes?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "name is required" }, 400);

  const scopes = body.scopes ?? ["read", "write", "execute"];
  const { id, key } = await createApiKey(userId, name, scopes);

  return c.json({ id, name, key, scopes }, 201);
});

// DELETE /:id — revoke a key
apiKeys.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const supabase = getSupabase();

  const { error } = await supabase.from("api_key").delete().eq("id", id).eq("user_id", userId);

  if (error) return c.json({ error: "Failed to revoke key" }, 500);
  return c.json({ ok: true });
});

export default apiKeys;
