import type { MiddlewareHandler } from "hono";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { AppEnv } from "./types";

/**
 * Hono middleware that extracts userId from Authorization: Bearer <session-token>.
 * Looks up the token in the BetterAuth session table and validates expiry.
 * Sets c.set("userId", ...) and c.set("session", ...) on success.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.token, token))
    .limit(1);

  const session = rows[0];
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check expiry
  if (session.expiresAt < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("userId", session.userId);
  c.set("session", session);

  await next();
};
