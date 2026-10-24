import type { MastraAuthConfig } from "@mastra/core/server";
import { type ResolvedIdentity, resolveFromRequest } from "./identity";

/**
 * `server.auth` for the Mastra instance (foreman-359q).
 *
 * Without it Mastra lets every route through: its built-in `/api/*` surface
 * (memory threads, stored agents, agent-controller sessions keyed by a
 * resourceId in the URL, a2a, background tasks) answered anyone. Mastra now
 * authenticates its built-in routes and our `apiRoutes` with Foreman's own
 * identity resolver (Supabase JWT or `fmn_` API key).
 *
 * Signing in is not enough for the built-in routes: they take a resourceId or
 * thread id from the caller and don't check it belongs to them, so any user
 * could read another's threads. Foreman's web app never calls them (it uses the
 * chat-kit routes, which scope by user), so `authorize` closes them to everyone
 * except Mastra Studio under `mastra dev`. Routes declared `requiresAuth: false`
 * (the native channel webhooks) skip all of this.
 */

/** Studio's stand-in user under `mastra dev`; never issued in production. */
export type DevStudioUser = { devStudio: true };
export type ServerAuthUser = ResolvedIdentity | DevStudioUser;

// Mastra's route auth and the chat-kit middleware both resolve the same
// request; remember the answer so it costs one lookup.
const resolved = new WeakMap<Request, Promise<ResolvedIdentity | null>>();

/** `resolveFromRequest`, resolved at most once per request. */
export function identityForRequest(request: Request): Promise<ResolvedIdentity | null> {
  let identity = resolved.get(request);
  if (!identity) {
    identity = resolveFromRequest(request);
    resolved.set(request, identity);
  }
  return identity;
}

function isDevStudio(request: Request): boolean {
  // Same rule Mastra applies when no auth is configured: Studio on localhost
  // sends this header, and it only counts under `mastra dev`.
  return (
    process.env.MASTRA_DEV === "true" && request.headers.get("x-mastra-dev-playground") === "true"
  );
}

function webRequest(request: unknown): Request | undefined {
  if (request instanceof Request) return request;
  const raw = (request as { raw?: unknown } | undefined)?.raw;
  return raw instanceof Request ? raw : undefined;
}

export const foremanServerAuth: MastraAuthConfig<ServerAuthUser> = {
  // Mastra calls this even with no Bearer token; the resolver reads the
  // Authorization and x-api-key headers itself.
  authenticateToken: async (_token, request) => {
    const req = webRequest(request);
    if (!req) return null as unknown as ServerAuthUser;
    if (isDevStudio(req)) return { devStudio: true };
    return (await identityForRequest(req)) as ServerAuthUser;
  },
  authorize: async (path, _method, user) => {
    if ("devStudio" in user) return true;
    return !(path === "/api" || path.startsWith("/api/"));
  },
};
