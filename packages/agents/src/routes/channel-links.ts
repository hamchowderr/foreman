import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getSupabase } from "../lib/db";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const VALID_CHANNELS = [
  "telegram",
  "discord",
  "slack",
  "teams",
  "gchat",
  "whatsapp",
  "github",
  "linear",
  "imessage",
] as const;

type Channel = (typeof VALID_CHANNELS)[number];

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const channelLinks = new Hono<AppEnv>();

channelLinks.use("/*", authMiddleware);

// POST / — generate a linking code for a channel
channelLinks.post("/", async (c) => {
  const userId = c.get("userId");
  let body: { channel?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const channel = body.channel as Channel;
  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return c.json({ error: `channel must be one of: ${VALID_CHANNELS.join(", ")}` }, 400);
  }

  const supabase = getSupabase();
  const id = randomUUID();
  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const { error } = await supabase.from("channel_link_code").insert({
    id,
    user_id: userId,
    channel,
    code,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  });

  if (error) return c.json({ error: "Failed to generate link code" }, 500);

  return c.json({ code, expires_at: expiresAt.toISOString() }, 201);
});

// GET /identities — list user's connected channel identities
channelLinks.get("/identities", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("channel_identity")
    .select("id, channel, channel_user_id, display_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: "Failed to list identities" }, 500);
  return c.json({ identities: data ?? [] });
});

// DELETE /identities/:id — unlink a channel identity
channelLinks.delete("/identities/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const supabase = getSupabase();

  const { error } = await supabase
    .from("channel_identity")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return c.json({ error: "Failed to unlink identity" }, 500);
  return c.json({ ok: true });
});

export default channelLinks;
