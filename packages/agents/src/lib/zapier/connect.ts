import { randomUUID, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { encryptToken } from "../crypto";
import { getEnv } from "../env";

const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

// In-memory store for pending connect requests.
// Key: one-time token, Value: { userId, state, expiresAt }
const pendingConnects = new Map<
  string,
  { userId: string; state: string; expiresAt: number }
>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingConnects) {
    if (entry.expiresAt < now) pendingConnects.delete(token);
  }
}, 60_000);

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a one-time connect URL for non-web channels.
 * The user opens this in their browser to start the Zapier OAuth flow.
 */
export function generateConnectUrl(userId: string): string {
  const env = getEnv();
  const serverUrl = env.AGENT_SERVER_URL;
  if (!serverUrl) {
    throw new Error("AGENT_SERVER_URL is not configured");
  }

  const token = randomUUID();
  const state = randomBytes(16).toString("hex");

  pendingConnects.set(token, {
    userId,
    state,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return `${serverUrl}/zapier/connect/${token}`;
}

/**
 * Validate a one-time connect token.
 * Returns the pending entry and removes it (one-time use).
 */
export function consumeConnectToken(
  token: string
): { userId: string; state: string } | null {
  const entry = pendingConnects.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingConnects.delete(token);
    return null;
  }
  pendingConnects.delete(token);
  return { userId: entry.userId, state: entry.state };
}

/**
 * Build the Zapier OAuth authorize URL.
 */
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const redirectUri =
    env.ZAPIER_REDIRECT_URI ||
    `${env.AGENT_SERVER_URL}/zapier/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.ZAPIER_CLIENT_ID || "",
    redirect_uri: redirectUri,
    state,
    scope: "profile zap zap:write action action:write",
  });

  return `${ZAPIER_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens and store them.
 */
export async function exchangeCodeAndStore(
  code: string,
  userId: string
): Promise<void> {
  const env = getEnv();
  const redirectUri =
    env.ZAPIER_REDIRECT_URI ||
    `${env.AGENT_SERVER_URL}/zapier/callback`;

  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.ZAPIER_CLIENT_ID || "",
      client_secret: env.ZAPIER_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zapier token exchange failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    scope?: string;
  };

  const now = new Date();
  const expiresIn = data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const db = getDb();

  // Upsert: delete existing then insert
  await db
    .delete(schema.zapierIdentity)
    .where(eq(schema.zapierIdentity.userId, userId));

  await db.insert(schema.zapierIdentity).values({
    id: randomUUID(),
    userId,
    accessToken: encryptToken(data.access_token),
    refreshToken: encryptToken(data.refresh_token),
    expiresAt,
    scopes: JSON.stringify(data.scope?.split(" ") ?? []),
    createdAt: now,
    updatedAt: now,
  });
}
