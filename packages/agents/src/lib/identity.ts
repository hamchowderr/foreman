import { getSupabase } from "./db";
import { createHash, randomUUID } from "node:crypto";

// ─── Supabase JWT Resolution ───

export interface SupabaseJwtResult {
  userId: string;
  orgId?: string;
}

/**
 * Validate a Supabase JWT via the admin client and extract user ID + org.
 * Uses the service_role client which verifies the JWT server-side.
 */
export async function resolveFromSupabaseJwt(
  token: string
): Promise<SupabaseJwtResult | null> {
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    return {
      userId: user.id,
      orgId: user.user_metadata?.org_id ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─── User Auto-Creation ───

async function ensureUserExists(userId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("user").upsert(
    {
      id: userId,
      name: userId,
      email: `${userId}@supabase.local`,
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

// ─── API Key Resolution ───

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function resolveFromApiKey(key: string): Promise<string | null> {
  const supabase = getSupabase();
  const keyHash = hashApiKey(key);

  const { data } = await supabase
    .from("api_key")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .limit(1)
    .single();

  if (!data) return null;

  // Update last used timestamp (fire and forget)
  supabase
    .from("api_key")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return data.user_id;
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ["read", "write", "execute"]
): Promise<{ id: string; key: string }> {
  const supabase = getSupabase();
  const id = randomUUID();
  const key = `fmn_${randomUUID().replace(/-/g, "")}`;
  const keyHash = hashApiKey(key);

  await supabase.from("api_key").insert({
    id,
    user_id: userId,
    key_hash: keyHash,
    name,
    scopes: JSON.stringify(scopes),
    created_at: new Date().toISOString(),
  });

  return { id, key };
}

// ─── Channel Identity Resolution ───

export async function resolveFromChannel(
  channel: string,
  channelUserId: string
): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("channel_identity")
    .select("user_id")
    .eq("channel", channel)
    .eq("channel_user_id", channelUserId)
    .limit(1)
    .single();

  return data?.user_id ?? null;
}

export async function registerChannelUser(
  channel: string,
  channelUserId: string,
  displayName?: string
): Promise<string> {
  const existing = await resolveFromChannel(channel, channelUserId);
  if (existing) return existing;

  const supabase = getSupabase();
  const userId = randomUUID();
  const now = new Date().toISOString();

  await supabase.from("user").insert({
    id: userId,
    name: displayName || `${channel}-${channelUserId}`,
    email: `${channel}-${channelUserId}@foreman.local`,
    email_verified: false,
    created_at: now,
    updated_at: now,
  });

  await supabase.from("channel_identity").insert({
    id: randomUUID(),
    user_id: userId,
    channel,
    channel_user_id: channelUserId,
    display_name: displayName ?? null,
    created_at: now,
  });

  return userId;
}

// ─── Unified Resolution ───

export interface ResolvedIdentity {
  userId: string;
  orgId?: string;
  channel: "web" | "telegram" | "slack" | "discord" | "mcp" | "a2a" | "dev" | "teams" | "gchat" | "whatsapp" | "github" | "linear" | "imessage";
}

/**
 * Resolve user identity from request headers.
 * Tries: Bearer token (Supabase JWT) → X-API-Key → null.
 */
export async function resolveFromRequest(
  request: Request
): Promise<ResolvedIdentity | null> {
  const authHeader = request.headers.get("authorization");

  // 1. Bearer token (Supabase JWT)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await resolveFromSupabaseJwt(token);
    if (result) {
      await ensureUserExists(result.userId);
      return { userId: result.userId, orgId: result.orgId, channel: "web" };
    }
  }

  // 2. API key
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    const userId = await resolveFromApiKey(apiKeyHeader);
    if (userId) return { userId, channel: "mcp" };
  }

  return null;
}
