import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { desc, eq, and } from "drizzle-orm";
import { authMiddleware } from "./middleware";
import { validateParam } from "@/lib/validation";
import type { AppEnv } from "./types";
import { getToolCatalog } from "@/lib/tool-catalog";

const storedAgents = new Hono<AppEnv>();

storedAgents.use("/*", authMiddleware);

// Default model when the user doesn't specify one.
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
const MAX_NAME_LEN = 120;
const MAX_DESC_LEN = 2000;
const MAX_INSTRUCTIONS_LEN = 50_000;
const MAX_TOOLS = 200;
const MAX_NOTES_LEN = 1000;

type AgentRow = typeof schema.storedAgent.$inferSelect;
type VersionRow = typeof schema.storedAgentVersion.$inferSelect;

function serializeAgent(a: AgentRow, latest?: VersionRow | null) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    current_version_id: a.currentVersionId,
    latest_version: latest ? serializeVersion(latest) : null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  };
}

function serializeVersion(v: VersionRow) {
  let tools: string[];
  try {
    const parsed = JSON.parse(v.tools);
    tools = Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    tools = [];
  }
  return {
    id: v.id,
    agent_id: v.agentId,
    version: v.version,
    instructions: v.instructions,
    tools,
    model: v.model,
    notes: v.notes,
    published_at: v.publishedAt?.toISOString() ?? null,
    created_at: v.createdAt.toISOString(),
    is_draft: v.publishedAt === null,
  };
}

async function loadAgent(
  db: ReturnType<typeof getDb>,
  id: string,
  userId: string
): Promise<AgentRow | null> {
  const rows = await db
    .select()
    .from(schema.storedAgent)
    .where(
      and(eq(schema.storedAgent.id, id), eq(schema.storedAgent.userId, userId))
    )
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestVersion(
  db: ReturnType<typeof getDb>,
  agentId: string
): Promise<VersionRow | null> {
  const rows = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.agentId, agentId))
    .orderBy(desc(schema.storedAgentVersion.version))
    .limit(1);
  return rows[0] ?? null;
}

function sanitizeTools(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_TOOLS) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of input) {
    if (typeof t !== "string") return null;
    const trimmed = t.trim();
    if (!trimmed || trimmed.length > 200) return null;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// ─── Tools catalog ───
// GET /tools — list available tool IDs with metadata. Placed before /:id so it
// doesn't collide with the ID route.
storedAgents.get("/tools", async (c) => {
  const catalog = await getToolCatalog();
  return c.json({ tools: catalog });
});

// ─── Agent CRUD ───

// POST / — create agent and its initial v1 draft
storedAgents.post("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { name, description, instructions, tools, model } = body ?? {};
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LEN) {
    return c.json({ error: "name is required (max 120 chars)" }, 400);
  }
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== "string" || description.length > MAX_DESC_LEN)
  ) {
    return c.json({ error: "description must be a string (max 2000 chars)" }, 400);
  }
  const initialInstructions = typeof instructions === "string" ? instructions : "";
  if (initialInstructions.length > MAX_INSTRUCTIONS_LEN) {
    return c.json({ error: "instructions too long (max 50KB)" }, 400);
  }
  const initialTools = tools === undefined ? [] : sanitizeTools(tools);
  if (initialTools === null) {
    return c.json({ error: "tools must be an array of tool id strings" }, 400);
  }
  const initialModel =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL;

  const now = new Date();
  const agentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  await db.insert(schema.storedAgent).values({
    id: agentId,
    userId,
    orgId: orgId ?? null,
    name: name.trim(),
    description: description ?? null,
    currentVersionId: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.storedAgentVersion).values({
    id: versionId,
    agentId,
    version: 1,
    instructions: initialInstructions,
    tools: JSON.stringify(initialTools),
    model: initialModel,
    notes: null,
    publishedAt: null,
    createdAt: now,
  });

  const agent = await loadAgent(db, agentId, userId);
  const latest = await getLatestVersion(db, agentId);
  return c.json(serializeAgent(agent!, latest), 201);
});

// GET / — list agents for current user/org
storedAgents.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const db = getDb();

  const whereClause = orgId
    ? and(eq(schema.storedAgent.userId, userId), eq(schema.storedAgent.orgId, orgId))
    : eq(schema.storedAgent.userId, userId);

  const agents = await db
    .select()
    .from(schema.storedAgent)
    .where(whereClause)
    .orderBy(desc(schema.storedAgent.updatedAt));

  // Batch-load the latest version for each agent.
  const results = await Promise.all(
    agents.map(async (a) => {
      const latest = await getLatestVersion(db, a.id);
      return serializeAgent(a, latest);
    })
  );

  return c.json(results);
});

// GET /:id — detail with latest version
storedAgents.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);
  const db = getDb();

  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);
  const latest = await getLatestVersion(db, id);
  return c.json(serializeAgent(agent, latest));
});

// PATCH /:id — update metadata (name, description)
storedAgents.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const db = getDb();
  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const patch: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > MAX_NAME_LEN) {
      return c.json({ error: "name must be 1-120 chars" }, 400);
    }
    patch.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > MAX_DESC_LEN)) {
      return c.json({ error: "description must be a string (max 2000 chars) or null" }, 400);
    }
    patch.description = body.description;
  }

  if (Object.keys(patch).length === 0) {
    return c.json(serializeAgent(agent, await getLatestVersion(db, id)));
  }

  await db
    .update(schema.storedAgent)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.storedAgent.id, id));

  const updated = await loadAgent(db, id, userId);
  const latest = await getLatestVersion(db, id);
  return c.json(serializeAgent(updated!, latest));
});

// DELETE /:id — cascade via FK on version table
storedAgents.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);
  const db = getDb();

  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  // Null out current_version_id first so the FK-less self-reference isn't dangling.
  await db
    .update(schema.storedAgent)
    .set({ currentVersionId: null })
    .where(eq(schema.storedAgent.id, id));
  await db
    .delete(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.agentId, id));
  await db.delete(schema.storedAgent).where(eq(schema.storedAgent.id, id));
  return c.json({ ok: true });
});

// ─── Versions ───

// GET /:id/versions — all versions, newest first
storedAgents.get("/:id/versions", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);
  const db = getDb();

  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const versions = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.agentId, id))
    .orderBy(desc(schema.storedAgentVersion.version));

  return c.json(versions.map(serializeVersion));
});

// GET /:id/versions/:versionId
storedAgents.get("/:id/versions/:versionId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const versionId = validateParam(c.req.param("versionId"), "versionId");
  if (!id || !versionId) return c.json({ error: "Invalid id" }, 400);
  const db = getDb();

  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(
      and(
        eq(schema.storedAgentVersion.id, versionId),
        eq(schema.storedAgentVersion.agentId, id)
      )
    )
    .limit(1);
  const v = rows[0];
  if (!v) return c.json({ error: "Not found" }, 404);
  return c.json(serializeVersion(v));
});

// POST /:id/versions — create a new draft by forking from a source version
// (or the latest if no sourceVersionId provided).
storedAgents.post("/:id/versions", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}

  const db = getDb();
  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  // If a draft already exists for this agent, return it — we never keep
  // more than one trailing draft.
  const latest = await getLatestVersion(db, id);
  if (latest && latest.publishedAt === null) {
    return c.json(serializeVersion(latest), 200);
  }

  // Pick the source to copy from: explicit sourceVersionId, else latest
  // (which is guaranteed published at this point since no draft exists).
  let source: VersionRow | null = latest;
  if (body.sourceVersionId && typeof body.sourceVersionId === "string") {
    const sourceRows = await db
      .select()
      .from(schema.storedAgentVersion)
      .where(
        and(
          eq(schema.storedAgentVersion.id, body.sourceVersionId),
          eq(schema.storedAgentVersion.agentId, id)
        )
      )
      .limit(1);
    if (!sourceRows[0]) {
      return c.json({ error: "sourceVersionId not found" }, 400);
    }
    source = sourceRows[0];
  }

  const nextVersion = (latest?.version ?? 0) + 1;
  const now = new Date();
  const versionId = crypto.randomUUID();

  await db.insert(schema.storedAgentVersion).values({
    id: versionId,
    agentId: id,
    version: nextVersion,
    instructions: source?.instructions ?? "",
    tools: source?.tools ?? "[]",
    model: source?.model ?? DEFAULT_MODEL,
    notes: null,
    publishedAt: null,
    createdAt: now,
  });
  await db
    .update(schema.storedAgent)
    .set({ updatedAt: now })
    .where(eq(schema.storedAgent.id, id));

  const created = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.id, versionId))
    .limit(1);
  return c.json(serializeVersion(created[0]), 201);
});

// PATCH /:id/versions/:versionId — edit draft content. Published versions are
// immutable; attempts to edit return 409.
storedAgents.patch("/:id/versions/:versionId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const versionId = validateParam(c.req.param("versionId"), "versionId");
  if (!id || !versionId) return c.json({ error: "Invalid id" }, 400);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const db = getDb();
  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(
      and(
        eq(schema.storedAgentVersion.id, versionId),
        eq(schema.storedAgentVersion.agentId, id)
      )
    )
    .limit(1);
  const v = rows[0];
  if (!v) return c.json({ error: "Not found" }, 404);
  if (v.publishedAt !== null) {
    return c.json(
      { error: "Cannot edit a published version. Create a new draft instead." },
      409
    );
  }

  const patch: Partial<typeof v> = {};
  if (body.instructions !== undefined) {
    if (typeof body.instructions !== "string" || body.instructions.length > MAX_INSTRUCTIONS_LEN) {
      return c.json({ error: "instructions must be a string (max 50KB)" }, 400);
    }
    patch.instructions = body.instructions;
  }
  if (body.tools !== undefined) {
    const cleaned = sanitizeTools(body.tools);
    if (cleaned === null) {
      return c.json({ error: "tools must be an array of tool id strings" }, 400);
    }
    patch.tools = JSON.stringify(cleaned);
  }
  if (body.model !== undefined) {
    if (typeof body.model !== "string" || !body.model.trim() || body.model.length > 200) {
      return c.json({ error: "model must be a non-empty string" }, 400);
    }
    patch.model = body.model.trim();
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && (typeof body.notes !== "string" || body.notes.length > MAX_NOTES_LEN)) {
      return c.json({ error: "notes must be a string (max 1000 chars) or null" }, 400);
    }
    patch.notes = body.notes;
  }

  if (Object.keys(patch).length === 0) {
    return c.json(serializeVersion(v));
  }

  await db
    .update(schema.storedAgentVersion)
    .set(patch)
    .where(eq(schema.storedAgentVersion.id, versionId));
  await db
    .update(schema.storedAgent)
    .set({ updatedAt: new Date() })
    .where(eq(schema.storedAgent.id, id));

  const updated = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.id, versionId))
    .limit(1);
  return c.json(serializeVersion(updated[0]));
});

// POST /:id/versions/:versionId/publish — mark the version as published and
// bump the agent's current_version_id pointer.
storedAgents.post("/:id/versions/:versionId/publish", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const versionId = validateParam(c.req.param("versionId"), "versionId");
  if (!id || !versionId) return c.json({ error: "Invalid id" }, 400);
  const db = getDb();

  const agent = await loadAgent(db, id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(
      and(
        eq(schema.storedAgentVersion.id, versionId),
        eq(schema.storedAgentVersion.agentId, id)
      )
    )
    .limit(1);
  const v = rows[0];
  if (!v) return c.json({ error: "Not found" }, 404);

  const now = new Date();
  if (v.publishedAt === null) {
    await db
      .update(schema.storedAgentVersion)
      .set({ publishedAt: now })
      .where(eq(schema.storedAgentVersion.id, versionId));
  }
  await db
    .update(schema.storedAgent)
    .set({ currentVersionId: versionId, updatedAt: now })
    .where(eq(schema.storedAgent.id, id));

  const updatedVersion = await db
    .select()
    .from(schema.storedAgentVersion)
    .where(eq(schema.storedAgentVersion.id, versionId))
    .limit(1);
  const updatedAgent = await loadAgent(db, id, userId);
  return c.json({
    agent: serializeAgent(updatedAgent!, updatedVersion[0]),
    version: serializeVersion(updatedVersion[0]),
  });
});

export default storedAgents;
