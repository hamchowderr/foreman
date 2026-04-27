import { randomUUID, randomBytes } from "node:crypto";
import { getSupabase } from "../db";
import { encryptToken } from "../crypto";
import { getEnv } from "../env";

const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

// Scopes required for the Zapier SDK to work
const ZAPIER_SCOPE = "internal credentials offline_access";

// In-memory store for pending connect requests (bot channel flow).
const pendingConnects = new Map<
  string,
  { userId: string; state: string; expiresAt: number }
>();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingConnects) {
    if (entry.expiresAt < now) pendingConnects.delete(token);
  }
}, 60_000);

const TOKEN_TTL_MS = 15 * 60 * 1000;

function getRedirectUri(): string {
  const env = getEnv();
  return env.ZAPIER_REDIRECT_URI || `${env.AGENT_SERVER_URL}/zapier/callback`;
}

/**
 * Generate a one-time connect URL for non-web channels.
 */
export function generateConnectUrl(userId: string): string {
  const env = getEnv();
  const serverUrl = env.AGENT_SERVER_URL;
  if (!serverUrl) throw new Error("AGENT_SERVER_URL is not configured");

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
 * Validate and consume a one-time connect token.
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
 * Build the Zapier OAuth authorize URL using Foreman's own OAuth app.
 */
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.ZAPIER_CLIENT_ID || "",
    redirect_uri: redirectUri,
    state,
    scope: ZAPIER_SCOPE,
  });

  return `${ZAPIER_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens and store them in Supabase.
 */
export async function exchangeCodeAndStore(
  code: string,
  userId: string
): Promise<void> {
  const env = getEnv();
  const redirectUri = getRedirectUri();

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

  const now = new Date().toISOString();
  const expiresIn = data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const supabase = getSupabase();
  await supabase.from("zapier_identity").upsert(
    {
      id: randomUUID(),
      user_id: userId,
      access_token: encryptToken(data.access_token),
      refresh_token: encryptToken(data.refresh_token),
      expires_at: expiresAt,
      scopes: JSON.stringify(data.scope?.split(" ") ?? []),
      created_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
}
