import { Hono } from "hono";
import { getLatestSnapshot, getSnapshotHistory } from "@/lib/dashboards/snapshot";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Dashboard data routes (Phase 1: snapshot reads).
 *
 * Snapshots are append-only rows pulled from a user's connected app
 * (see src/mastra/signals/zapier-poll-provider.ts + lib/dashboards/snapshot.ts),
 * keyed by (user_id, app_key). Phase 1 exposes them by app_key because the
 * `dashboard` table doesn't exist yet (Phase 2). We deliberately namespace under
 * `/snapshots/:appKey` so the future `/dashboards/:id` routes won't collide.
 *
 *   GET /dashboards/snapshots/:appKey                  → latest snapshot
 *   GET /dashboards/snapshots/:appKey?history=true     → series, newest-first
 *       &since=<iso>   filter to snapshots at/after this timestamp
 *       &limit=<n>     cap the series (1..500, default 100)
 *
 * All routes require auth and are scoped to the caller's userId.
 */
const dashboards = new Hono<AppEnv>();

dashboards.use("/*", authMiddleware);

dashboards.get("/snapshots/:appKey", async (c) => {
  const userId = c.get("userId");
  const appKey = validateParam(c.req.param("appKey"), "appKey");
  if (!appKey) {
    return c.json({ error: "Invalid appKey" }, 400);
  }

  const history = c.req.query("history") === "true";

  if (!history) {
    const snapshot = await getLatestSnapshot(userId, appKey);
    if (!snapshot) {
      return c.json({ error: "No snapshot found for this app" }, 404);
    }
    return c.json(snapshot);
  }

  // History series — optional since + limit.
  const since = c.req.query("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return c.json({ error: "since must be an ISO timestamp" }, 400);
  }

  const rawLimit = c.req.query("limit");
  let limit: number | undefined;
  if (rawLimit !== undefined) {
    const n = Number.parseInt(rawLimit, 10);
    if (Number.isNaN(n) || n < 1) {
      return c.json({ error: "limit must be a positive integer" }, 400);
    }
    limit = Math.min(n, 500);
  }

  const series = await getSnapshotHistory(userId, appKey, { since, limit });
  return c.json({ appKey, count: series.length, snapshots: series });
});

export default dashboards;
