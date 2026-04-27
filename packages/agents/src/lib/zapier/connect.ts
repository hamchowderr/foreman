import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { getSupabase } from "../db";
import { encryptToken } from "../crypto";
import { getEnv } from "../env";

const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

// The Zapier SDK's public PKCE client ID — same one `zapier-sdk login` CLI uses.
// Zapier only accepts this client ID with redirect URIs on these specific ports.
const ZAPIER_PKCE_CLIENT_ID = "grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6";
const LOGIN_PORTS = [49505, 50575, 52804, 55981, 61010, 63851];

// Scope that produces SDK-compatible tokens with offline_access (refresh token).
const ZAPIER_SCOPE = "internal credentials offline_access";

// In-memory store for pending connect requests.
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

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function findAvailablePort(): Promise<number> {
  for (const port of LOGIN_PORTS) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.listen(port, () => { server.close(); resolve(true); });
      server.on("error", () => resolve(false));
    });
    if (available) return port;
  }
  throw new Error(
    `No OAuth callback ports available. Ports tried: ${LOGIN_PORTS.join(", ")}`
  );
}

/**
 * Start a temporary HTTP server on a Zapier-registered login port.
 * When Zapier redirects back to http://localhost:<port>/oauth, the server
 * captures the code and state, relays them to the main server's /oauth handler,
 * then shuts down.
 */
async function startRelayServer(
  port: number,
  mainServerOauthUrl: string
): Promise<void> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== "/oauth") {
        res.writeHead(404);
        res.end();
        return;
      }

      const relayUrl = new URL(mainServerOauthUrl);
      url.searchParams.forEach((value, key) => {
        relayUrl.searchParams.set(key, value);
      });

      res.writeHead(302, { Location: relayUrl.toString() });
      res.end();
      server.close(() => resolve());
    });

    server.listen(port);
    setTimeout(() => server.close(() => resolve()), TOKEN_TTL_MS);
  });
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
 * Build the Zapier OAuth PKCE authorize URL.
 *
 * For local dev (no ZAPIER_REDIRECT_URI set): spins up a temporary relay server
 * on one of the ports Zapier's PKCE client accepts, which proxies the callback
 * to our main server's /oauth handler.
 *
 * For production (ZAPIER_REDIRECT_URI set): uses that URI directly.
 */
export async function buildAuthorizeUrl(
  state: string
): Promise<{ authorizeUrl: string; codeVerifier: string; redirectUri: string }> {
  const env = getEnv();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  let redirectUri: string;

  if (env.ZAPIER_REDIRECT_URI) {
    redirectUri = env.ZAPIER_REDIRECT_URI;
  } else {
    const port = await findAvailablePort();
    const localPort = Number(process.env.PORT) || 4111;
    const mainOauthUrl = `http://localhost:${localPort}/oauth`;
    redirectUri = `http://localhost:${port}/oauth`;
    startRelayServer(port, mainOauthUrl);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZAPIER_PKCE_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: ZAPIER_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    authorizeUrl: `${ZAPIER_AUTHORIZE_URL}?${params.toString()}`,
    codeVerifier,
    redirectUri,
  };
}

/**
 * Exchange an authorization code for tokens and store them.
 */
export async function exchangeCodeAndStore(
  code: string,
  userId: string,
  codeVerifier: string,
  redirectUri: string
): Promise<void> {
  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: ZAPIER_PKCE_CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
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
