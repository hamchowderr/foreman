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

// ─── BetterAuth Session Resolution ───

export async function resolveFromSessionToken(
  token: string
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.token, token))
    .limit(1);

  const session = rows[0];
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session.userId;
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
  channel: "web" | "telegram" | "slack" | "discord" | "mcp" | "a2a" | "dev";
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

  // 1. Bearer token (BetterAuth session)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await resolveFromSessionToken(token);
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
