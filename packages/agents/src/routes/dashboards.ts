import { Hono } from "hono";
import { getArtifactWithData } from "@/lib/dashboards/artifact";
import { createShare, getSharedArtifact, revokeShare } from "@/lib/dashboards/share";
import { getLatestSnapshot, getSnapshotHistory } from "@/lib/dashboards/snapshot";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Dashboard data routes (Phase 1: snapshot reads).
 *
 * Snapshots are append-only rows pulled from a user's connected app
 * (written via saveSnapshot in lib/dashboards/snapshot.ts), keyed by
 * (user_id, app_key). Phase 1 exposes them by app_key because the
 * `dashboard` table doesn't exist yet (Phase 2). We deliberately namespace under
 * `/snapshots/:appKey` so the future `/dashboards/:id` routes won't collide.
 *
 *   GET /dashboards/snapshots/:appKey                  → latest snapshot
 *   GET /dashboards/snapshots/:appKey?history=true     → series, newest-first
 *       &since=<iso>   filter to snapshots at/after this timestamp
 *       &limit=<n>     cap the series (1..500, default 100)
 *
 * Phase 3 (public sharing):
 *   POST   /dashboards/artifacts/:id/share   → mint a public share token (authed)
 *   DELETE /dashboards/shares/:shareToken    → revoke a share (authed)
 *   GET    /dashboards/public/:shareToken    → render data, NO auth (token = grant)
 *
 * Auth is scoped per group: the owner-scoped read/write routes require auth; the
 * public share route is intentionally unauthenticated.
 */
const dashboards = new Hono<AppEnv>();

dashboards.use("/artifacts/*", authMiddleware);
dashboards.use("/snapshots/*", authMiddleware);
dashboards.use("/shares/*", authMiddleware);

// GET /dashboards/public/:shareToken — public share page data. NO auth: a valid,
// unexpired token is the capability. Returns the same shape as the authed
// artifact read (spec + records), so the web renderer is identical. Unknown or
// expired tokens 404 (no existence leak).
dashboards.get("/public/:shareToken", async (c) => {
  const token = validateParam(c.req.param("shareToken"), "shareToken");
  if (!token) {
    return c.json({ error: "Invalid share token" }, 400);
  }
  const artifact = await getSharedArtifact(token);
  if (!artifact) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(artifact);
});

// GET /dashboards/artifacts/:id — a stored dashboard artifact (spec + the
// records it renders), scoped to the caller. Powers the /dashboards/[id] page.
dashboards.get("/artifacts/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid artifact id" }, 400);
  }
  const artifact = await getArtifactWithData(workspaceId, id);
  if (!artifact) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(artifact);
});

// POST /dashboards/artifacts/:id/share — mint a public share token for a
// dashboard the caller owns. Optional body { expiresInDays } for a link that
// auto-expires. Returns the token + the relative public path the web app serves.
dashboards.post("/artifacts/:id/share", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid artifact id" }, 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as { expiresInDays?: unknown };
  let expiresInDays: number | undefined;
  if (body.expiresInDays !== undefined) {
    const n = Number(body.expiresInDays);
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      return c.json({ error: "expiresInDays must be a positive number of days (<= 3650)" }, 400);
    }
    expiresInDays = n;
  }

  const share = await createShare(workspaceId, userId, id, { expiresInDays });
  if (!share) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ token: share.token, url: `/d/${share.token}`, expiresAt: share.expiresAt }, 201);
});

// DELETE /dashboards/shares/:shareToken — revoke a share, owner-scoped.
dashboards.delete("/shares/:shareToken", async (c) => {
  const workspaceId = c.get("workspaceId");
  const token = validateParam(c.req.param("shareToken"), "shareToken");
  if (!token) {
    return c.json({ error: "Invalid share token" }, 400);
  }
  const revoked = await revokeShare(workspaceId, token);
  if (!revoked) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ revoked: true });
});

dashboards.get("/snapshots/:appKey", async (c) => {
  const workspaceId = c.get("workspaceId");
  const appKey = validateParam(c.req.param("appKey"), "appKey");
  if (!appKey) {
    return c.json({ error: "Invalid appKey" }, 400);
  }

  const history = c.req.query("history") === "true";

  if (!history) {
    const snapshot = await getLatestSnapshot(workspaceId, appKey);
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

  const series = await getSnapshotHistory(workspaceId, appKey, { since, limit });
  return c.json({ appKey, count: series.length, snapshots: series });
});

export default dashboards;
