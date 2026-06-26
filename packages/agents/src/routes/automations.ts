import { Hono } from "hono";
import {
  getInboxView,
  inspectForUser,
  listForUser,
  provisionAutomation,
  removeAutomationForUser,
  runAutomationById,
  updateAutomationForUser,
} from "@/lib/automations/service";
import type { InboxTriggerSpec } from "@/lib/automations/types";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Automation routes (foreman-l7xq M2) — workspace-scoped CRUD over durable
 * automations, the web-facing twin of the agent's automation tools. Both go
 * through lib/automations/service, so deploy+persist is one code path. All routes
 * require auth; the workspace is the caller's active workspace.
 *
 *   GET    /automations           → list the workspace's automations
 *   POST   /automations           → deploy + persist a new automation
 *   GET    /automations/:id        → automation + recent runs
 *   PATCH  /automations/:id        → rename / describe / enable-disable
 *   POST   /automations/:id/run    → manually fire it
 *   DELETE /automations/:id        → remove (row + best-effort Zapier workflow)
 */
const automations = new Hono<AppEnv>();

automations.use("/*", authMiddleware);

automations.get("/", async (c) => {
  const userId = c.get("userId");
  return c.json({ automations: await listForUser(userId) });
});

automations.post("/", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    source?: unknown;
    connections?: unknown;
    trigger?: unknown;
    enabled?: unknown;
    isPrivate?: unknown;
  };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return c.json({ error: "name is required" }, 400);
  }
  if (typeof body.source !== "string" || !body.source.trim()) {
    return c.json({ error: "source is required" }, 400);
  }

  const result = await provisionAutomation({
    userId,
    workspaceId,
    name: body.name,
    description: typeof body.description === "string" ? body.description : undefined,
    source: body.source,
    connections: body.connections as Record<string, string | number> | undefined,
    trigger: body.trigger as InboxTriggerSpec | undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    isPrivate: typeof body.isPrivate === "boolean" ? body.isPrivate : undefined,
  });
  return c.json(result, 201);
});

automations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const result = await inspectForUser(userId, id);
  if (!result) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(result);
});

automations.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    enabled?: unknown;
  };
  const patch: { name?: string; description?: string | null; enabled?: boolean } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string" || body.description === null) {
    patch.description = body.description as string | null;
  }
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

  const ok = await updateAutomationForUser(userId, id, patch);
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ updated: true });
});

automations.get("/:id/inbox", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const view = await getInboxView(userId, id);
  if (!view) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(view);
});

automations.post("/:id/run", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as { input?: Record<string, unknown> };
  const result = await runAutomationById(userId, id, body.input);
  if (!result) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(result);
});

automations.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const ok = await removeAutomationForUser(userId, id);
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ deleted: true });
});

export default automations;
