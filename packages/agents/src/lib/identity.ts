import { eq, and } from "drizzle-orm";
import { getDb, schema } from "./db";
import { timingSafeEqual, createHash, randomUUID } from "node:crypto";

/**
 * Channel-agnostic user resolution.
 * Resolves a Foreman userId from any channel:
 * 1. BetterAuth session token (web)
 * 2. API key (MCP/A2A)
 * 3. Channel identity (Telegram, Slack, Discord)
 */

// ─── Clerk JWT Resolution ───

/**
 * Verify a Clerk JWT and extract the user ID (sub claim).
 * In dev, we decode without full verification for simplicity.
 * In production, use Clerk's JWKS endpoint for proper verification.
 */
export async function resolveFromClerkJwt(
  token: string
): Promise<string | null> {
  try {
    // Decode JWT payload (base64url)
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    // Return the Clerk user ID (sub claim)
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─── API Key Resolution ───

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function resolveFromApiKey(
  key: string
): Promise<string | null> {
  const db = getDb();
  const keyHash = hashApiKey(key);

  const rows = await db
    .select()
    .from(schema.apiKey)
    .where(eq(schema.apiKey.keyHash, keyHash))
    .limit(1);

  const apiKeyRow = rows[0];
  if (!apiKeyRow) return null;

  // Update last used timestamp (fire and forget)
  db.update(schema.apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKey.id, apiKeyRow.id))
    .then(() => {});

  return apiKeyRow.userId;
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ["read", "write", "execute"]
): Promise<{ id: string; key: string }> {
  const db = getDb();
  const id = randomUUID();
  const key = `fmn_${randomUUID().replace(/-/g, "")}`;
  const keyHash = hashApiKey(key);

  await db.insert(schema.apiKey).values({
    id,
    userId,
    keyHash,
    name,
    scopes: JSON.stringify(scopes),
    createdAt: new Date(),
  });

  return { id, key }; // key is only returned once — not stored in plaintext
}

// ─── Channel Identity Resolution ───

export async function resolveFromChannel(
  channel: string,
  channelUserId: string
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.channelIdentity)
    .where(
      and(
        eq(schema.channelIdentity.channel, channel),
        eq(schema.channelIdentity.channelUserId, channelUserId)
      )
    )
    .limit(1);

  return rows[0]?.userId ?? null;
}

export async function registerChannelUser(
  channel: string,
  channelUserId: string,
  displayName?: string
): Promise<string> {
  const db = getDb();

  // Check if already linked
  const existing = await resolveFromChannel(channel, channelUserId);
  if (existing) return existing;

  // Create a new Foreman user
  const userId = randomUUID();
  const now = new Date();

  await db.insert(schema.user).values({
    id: userId,
    name: displayName || `${channel}-${channelUserId}`,
    email: `${channel}-${channelUserId}@foreman.local`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  // Link channel identity
  await db.insert(schema.channelIdentity).values({
    id: randomUUID(),
    userId,
    channel,
    channelUserId,
    displayName,
    createdAt: now,
  });

  return userId;
}

// ─── Unified Resolution ───

export interface ResolvedIdentity {
  userId: string;
  channel: "web" | "telegram" | "slack" | "discord" | "mcp" | "a2a" | "dev" | "teams" | "gchat" | "whatsapp" | "github" | "linear" | "imessage";
}

/**
 * Resolve user identity from request headers/context.
 * Tries in order: Bearer token → API key → returns null.
 * Channel-specific resolution (Telegram) is handled separately in the bot.
 */
export async function resolveFromRequest(
  request: Request
): Promise<ResolvedIdentity | null> {
  const authHeader = request.headers.get("authorization");

  // 1. Bearer token (Clerk JWT)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await resolveFromClerkJwt(token);
    if (userId) return { userId, channel: "web" };
  }

  // 2. API key
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    const userId = await resolveFromApiKey(apiKeyHeader);
    if (userId) return { userId, channel: "mcp" };
  }

  return null;
}
