import type { MiddlewareHandler } from "hono";
import { resolveFromRequest } from "../lib/identity";
import type { AppEnv } from "./types";

/**
 * Channel-agnostic auth middleware.
 * Resolves userId from any channel:
 * 1. Authorization: Bearer <session-token> (web/BetterAuth)
 * 2. X-API-Key header (MCP/A2A)
 *
 * Sets c.set("userId", ...) on success.
 * Channel-specific resolution (Telegram) is handled in the bot, not here.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = await resolveFromRequest(c.req.raw);

  if (!identity) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", identity.userId);
  if (identity.workspaceId) {
    c.set("workspaceId", identity.workspaceId);
  }
  if (identity.orgId) {
    c.set("orgId", identity.orgId);
  }

  await next();
};
