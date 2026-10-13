// Same-origin proxy to the standalone Mastra server. The web app is pure
// frontend; thread CRUD lives on the server (over Mastra Memory), so these tiny
// Next route handlers forward to it. Keeps Mastra out of the Next webpack graph
// and avoids CORS.
//
// Users and auth — Foreman: every request carries the signed-in user's Supabase
// access token (from the SSR session cookie), the same way Foreman's other proxies
// (app/api/apps) do. The agents server validates it with its own identity resolver
// and gives each user their own Session and threads. No session → 401 here, and the
// request never reaches the server. (The kit's default — an HS256 token signed with
// MASTRA_JWT_SECRET — is kept below as `signServerToken`, unused by Foreman.)
import { createHmac } from "node:crypto";
import { createClient } from "@/lib/server";

const SERVER_URL =
  process.env.MASTRA_SERVER_URL ??
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL ??
  "http://localhost:4111";

export type ChatKitProxyConfig = {
  /**
   * The signed-in user's id for a request, or null when nobody is signed in. Read it
   * from your auth library (a session cookie, a header your middleware sets).
   */
  getUserId?: (request: Request) => Promise<string | null | undefined> | string | null | undefined;
};

// Kept on globalThis: route handlers and instrumentation.ts are bundled separately, so
// a module-level variable would not be shared between them.
const KEY = Symbol.for("mastra-chat-kit.proxy");
type Holder = { [KEY]?: ChatKitProxyConfig };

/** Set the proxy's host hooks. Call once at startup, from `instrumentation.ts`. */
export function configureChatKitProxy(config: ChatKitProxyConfig): void {
  (globalThis as Holder)[KEY] = config;
}

function proxyConfig(): ChatKitProxyConfig {
  return (globalThis as Holder)[KEY] ?? {};
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** A short-lived HS256 JWT for the Mastra server's MastraJwtAuth. */
export function signServerToken(secret: string, sub: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const body = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ sub, iat, exp: iat + 300 }),
  )}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

/** The single-user id the server uses when no user is configured. */
export const SHARED_USER = "chat-kit-user";

/**
 * The headers that identify a request to the Mastra server, or a 401 Response when a
 * user hook is configured and nobody is signed in.
 */
export async function serverHeaders(request: Request): Promise<Headers | Response> {
  const headers = new Headers();
  // Foreman: forward the Supabase session's access token.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }
  headers.set("authorization", `Bearer ${session.access_token}`);
  return headers;
}

/** The kit's original header logic (HS256 proxy token), kept for reference. */
export async function kitServerHeaders(request: Request): Promise<Headers | Response> {
  const headers = new Headers();
  const { getUserId } = proxyConfig();
  let user = SHARED_USER;
  if (getUserId) {
    const id = await getUserId(request);
    if (!id) {
      return Response.json({ error: "not signed in" }, { status: 401 });
    }
    user = id;
  }
  const secret = process.env.MASTRA_JWT_SECRET;
  if (secret) {
    headers.set("authorization", `Bearer ${signServerToken(secret, user)}`);
  }
  return headers;
}

/**
 * Forward a request to the Mastra server and stream its response back.
 *
 * `request` is the incoming request: it supplies the user (see above) and, for
 * streams, the abort signal so a client disconnect stops the run upstream.
 */
export async function forward(
  request: Request,
  path: string,
  init: RequestInit & { stream?: boolean } = {},
): Promise<Response> {
  const auth = await serverHeaders(request);
  if (auth instanceof Response) return auth;
  const { stream, headers: extra, ...rest } = init;
  const headers = new Headers(extra);
  for (const [name, value] of auth) headers.set(name, value);

  const upstream = await fetch(`${SERVER_URL}${path}`, {
    cache: "no-store",
    ...rest,
    headers,
    ...(stream ? { signal: request.signal } : {}),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? (stream ? "text/event-stream" : "application/json"),
      "cache-control": stream ? "no-cache, no-transform" : "no-store",
    },
  });
}

export { SERVER_URL };
