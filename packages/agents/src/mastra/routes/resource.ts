/**
 * Who a chat-kit request is for (Foreman's version of the kit's routes/resource.ts).
 *
 * The kit reads the resource id Mastra's JWT auth sets from a proxy-signed token.
 * Foreman instead authenticates these routes with its own identity resolver (the
 * user's Supabase JWT or an `fmn_` API key), in the `chatKitAuth` middleware that
 * index.ts runs before them. It stores the user here; the resource id IS the
 * Foreman user id, so each user gets their own Session and threads.
 */

/**
 * Request-context keys `chatKitAuth` sets. They live on Mastra's per-request
 * `requestContext`, the only thing Mastra carries from server middleware into
 * custom apiRoutes (which run on a separate Hono app).
 */
export const CHAT_KIT_USER_KEY = "foremanUserId";
export const CHAT_KIT_WORKSPACE_KEY = "foremanWorkspaceId";

/** Path prefixes of the kit's route contract (the ones `chatKitAuth` guards). */
export const CHAT_KIT_PREFIXES = ["/agent-controller", "/workspace", "/images", "/browser"];

// biome-ignore lint/suspicious/noExplicitAny: the Hono context type is Mastra-internal
export function resourceIdOf(c: any): string | undefined {
  return readKey(c, CHAT_KIT_USER_KEY);
}

/** The signed-in user's active workspace, when they have one. */
// biome-ignore lint/suspicious/noExplicitAny: the Hono context type is Mastra-internal
export function workspaceIdOf(c: any): string | undefined {
  return readKey(c, CHAT_KIT_WORKSPACE_KEY);
}

// biome-ignore lint/suspicious/noExplicitAny: the Hono context type is Mastra-internal
function readKey(c: any, key: string): string | undefined {
  try {
    const id = c.get("requestContext")?.get(key);
    return typeof id === "string" && id ? id : undefined;
  } catch {
    return undefined;
  }
}
