import { createHash, randomUUID } from "node:crypto";
import { getSupabase } from "./db";

// ─── Supabase JWT Resolution ───

export interface SupabaseJwtResult {
  userId: string;
  orgId?: string;
}

/**
 * Validate a Supabase JWT via the admin client and extract user ID + org.
 * Uses the service_role client which verifies the JWT server-side.
 */
export async function resolveFromSupabaseJwt(token: string): Promise<SupabaseJwtResult | null> {
  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
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

export async function ensureUserExists(userId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("user").upsert(
    {
      id: userId,
      name: userId,
      email: `${userId}@supabase.local`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

// ─── Workspace Resolution ───

/**
 * Create a personal solo workspace and return its id. Used for channel-only
 * principals, who have no auth.users row — so the signup trigger that provisions
 * a workspace for web users (handle_auth_user_created) never fired for them.
 */
async function createSoloWorkspace(name: string, slugBase: string): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const slug = `${slugBase}-${id.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  await supabase.from("workspaces").insert({ id, slug, name, membership_type: "solo" });
  return id;
}

/**
 * The active workspace a principal operates in. Reads `public.user
 * .default_workspace_id`; for web principals created before that column was
 * populated, lazily backfills it from the platform solo workspace
 * (`user_settings.default_workspace`, provisioned by the signup trigger).
 */
export async function resolveActiveWorkspace(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data: principal } = await supabase
    .from("user")
    .select("default_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (principal?.default_workspace_id) return principal.default_workspace_id as string;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("default_workspace")
    .eq("id", userId)
    .maybeSingle();
  if (settings?.default_workspace) {
    await supabase
      .from("user")
      .update({ default_workspace_id: settings.default_workspace })
      .eq("id", userId);
    return settings.default_workspace as string;
  }
  return null;
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
  scopes: string[] = ["read", "write", "execute"],
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
  channelUserId: string,
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
  displayName?: string,
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
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  // Channel-only principals get a personal solo workspace (they have no
  // auth.users row, so the signup trigger never provisioned one). They are NOT
  // workspace_members — that requires an auth-backed user_profile — so they join
  // a team by linking to a web account via channel_link_code.
  const workspaceId = await createSoloWorkspace(
    `${displayName || channelUserId}'s Workspace`,
    `${channel}-${channelUserId}`,
  );
  await supabase.from("user").update({ default_workspace_id: workspaceId }).eq("id", userId);

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

// ─── Channel Link Code Redemption ───

export interface RedeemResult {
  ok: boolean;
  error?: "not_found" | "expired" | "already_used";
}

/**
 * Redeem a linking code from a channel bot.
 * Associates the channel_user_id with the web user who generated the code.
 */
export async function redeemChannelLinkCode(
  code: string,
  channel: string,
  channelUserId: string,
  displayName?: string,
): Promise<RedeemResult> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("channel_link_code")
    .select("id, user_id, channel, expires_at, used_at")
    .eq("code", code.toUpperCase())
    .limit(1)
    .single();

  if (!data) return { ok: false, error: "not_found" };
  if (data.used_at) return { ok: false, error: "already_used" };
  if (data.expires_at < now) return { ok: false, error: "expired" };

  // Mark code as used
  await supabase.from("channel_link_code").update({ used_at: now }).eq("id", data.id);

  // Upsert channel_identity: link this channel account to the web user
  const { data: existing } = await supabase
    .from("channel_identity")
    .select("id, user_id")
    .eq("channel", channel)
    .eq("channel_user_id", channelUserId)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from("channel_identity")
      .update({ user_id: data.user_id, display_name: displayName ?? null })
      .eq("id", existing.id);
  } else {
    await supabase.from("channel_identity").insert({
      id: randomUUID(),
      user_id: data.user_id,
      channel,
      channel_user_id: channelUserId,
      display_name: displayName ?? null,
      created_at: now,
    });
  }

  return { ok: true };
}

// ─── Unified Resolution ───

export interface ResolvedIdentity {
  userId: string;
  workspaceId?: string;
  orgId?: string;
  channel:
    | "web"
    | "telegram"
    | "slack"
    | "discord"
    | "mcp"
    | "a2a"
    | "dev"
    | "teams"
    | "gchat"
    | "whatsapp"
    | "github"
    | "linear"
    | "imessage";
}

/**
 * Resolve user identity from request headers.
 * Tries: Bearer token (Supabase JWT) → X-API-Key → null.
 */
export async function resolveFromRequest(request: Request): Promise<ResolvedIdentity | null> {
  const authHeader = request.headers.get("authorization");

  // 1. Bearer token (Supabase JWT)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await resolveFromSupabaseJwt(token);
    if (result) {
      await ensureUserExists(result.userId);
      const workspaceId = (await resolveActiveWorkspace(result.userId)) ?? undefined;
      return { userId: result.userId, workspaceId, orgId: result.orgId, channel: "web" };
    }
  }

  // 2. API key
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    const userId = await resolveFromApiKey(apiKeyHeader);
    if (userId) {
      const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
      return { userId, workspaceId, channel: "mcp" };
    }
  }

  return null;
}
