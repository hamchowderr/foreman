import { Hono } from "hono";
import { getSupabase } from "@/lib/db";
import { authMiddleware } from "./middleware";
import { validateParam } from "@/lib/validation";
import type { AppEnv } from "./types";
import { getToolCatalog } from "@/lib/tool-catalog";

const storedAgents = new Hono<AppEnv>();

storedAgents.use("/*", authMiddleware);

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
const MAX_NAME_LEN = 120;
const MAX_DESC_LEN = 2000;
const MAX_INSTRUCTIONS_LEN = 50_000;
const MAX_TOOLS = 200;
const MAX_NOTES_LEN = 1000;

function serializeAgent(a: any, latest?: any | null) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    current_version_id: a.current_version_id,
    latest_version: latest ? serializeVersion(latest) : null,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

function serializeVersion(v: any) {
  let tools: string[];
  try {
    const parsed = JSON.parse(v.tools);
    tools = Array.isArray(parsed) ? parsed.filter((t: any) => typeof t === "string") : [];
  } catch {
    tools = [];
  }
  return {
    id: v.id,
    agent_id: v.agent_id,
    version: v.version,
    instructions: v.instructions,
    tools,
    model: v.model,
    notes: v.notes,
    published_at: v.published_at ?? null,
    created_at: v.created_at,
    is_draft: v.published_at === null,
  };
}

async function loadAgent(id: string, userId: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("stored_agent")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function getLatestVersion(agentId: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
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
storedAgents.get("/tools", async (c) => {
  const catalog = await getToolCatalog();
  return c.json({ tools: catalog });
});

// ─── Agent CRUD ───

// POST / — create agent and its initial v1 draft
storedAgents.post("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const supabase = getSupabase();

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

  const now = new Date().toISOString();
  const agentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  await supabase.from("stored_agent").insert({
    id: agentId,
    user_id: userId,
    org_id: orgId ?? null,
    name: name.trim(),
    description: description ?? null,
    current_version_id: null,
    created_at: now,
    updated_at: now,
  });

  await supabase.from("stored_agent_version").insert({
    id: versionId,
    agent_id: agentId,
    version: 1,
    instructions: initialInstructions,
    tools: JSON.stringify(initialTools),
    model: initialModel,
    notes: null,
    published_at: null,
    created_at: now,
  });

  const agent = await loadAgent(agentId, userId);
  const latest = await getLatestVersion(agentId);
  return c.json(serializeAgent(agent!, latest), 201);
});

// GET / — list agents for current user/org
storedAgents.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const supabase = getSupabase();

  let query = supabase
    .from("stored_agent")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data: agents } = await query;

  const results = await Promise.all(
    (agents ?? []).map(async (a: any) => {
      const latest = await getLatestVersion(a.id);
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

  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);
  const latest = await getLatestVersion(id);
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

  const supabase = getSupabase();
  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const patch: Record<string, any> = {};
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
    return c.json(serializeAgent(agent, await getLatestVersion(id)));
  }

  await supabase
    .from("stored_agent")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  const updated = await loadAgent(id, userId);
  const latest = await getLatestVersion(id);
  return c.json(serializeAgent(updated!, latest));
});

// DELETE /:id — cascade via FK on version table
storedAgents.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);
  const supabase = getSupabase();

  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  // Null out current_version_id first to avoid FK conflicts
  await supabase
    .from("stored_agent")
    .update({ current_version_id: null })
    .eq("id", id);
  await supabase.from("stored_agent_version").delete().eq("agent_id", id);
  await supabase.from("stored_agent").delete().eq("id", id);
  return c.json({ ok: true });
});

// ─── Versions ───

// GET /:id/versions — all versions, newest first
storedAgents.get("/:id/versions", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);
  const supabase = getSupabase();

  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const { data: versions } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("agent_id", id)
    .order("version", { ascending: false });

  return c.json((versions ?? []).map(serializeVersion));
});

// GET /:id/versions/:versionId
storedAgents.get("/:id/versions/:versionId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const versionId = validateParam(c.req.param("versionId"), "versionId");
  if (!id || !versionId) return c.json({ error: "Invalid id" }, 400);
  const supabase = getSupabase();

  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const { data: v } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .eq("agent_id", id)
    .limit(1)
    .maybeSingle();
  if (!v) return c.json({ error: "Not found" }, 404);
  return c.json(serializeVersion(v));
});

// POST /:id/versions — create a new draft
storedAgents.post("/:id/versions", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid agent id" }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch {}

  const supabase = getSupabase();
  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const latest = await getLatestVersion(id);
  if (latest && latest.published_at === null) {
    return c.json(serializeVersion(latest), 200);
  }

  let source: any = latest;
  if (body.sourceVersionId && typeof body.sourceVersionId === "string") {
    const { data: sourceV } = await supabase
      .from("stored_agent_version")
      .select("*")
      .eq("id", body.sourceVersionId)
      .eq("agent_id", id)
      .limit(1)
      .maybeSingle();
    if (!sourceV) {
      return c.json({ error: "sourceVersionId not found" }, 400);
    }
    source = sourceV;
  }

  const nextVersion = (latest?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();

  await supabase.from("stored_agent_version").insert({
    id: versionId,
    agent_id: id,
    version: nextVersion,
    instructions: source?.instructions ?? "",
    tools: source?.tools ?? "[]",
    model: source?.model ?? DEFAULT_MODEL,
    notes: null,
    published_at: null,
    created_at: now,
  });
  await supabase
    .from("stored_agent")
    .update({ updated_at: now })
    .eq("id", id);

  const { data: created } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .limit(1)
    .single();
  return c.json(serializeVersion(created), 201);
});

// PATCH /:id/versions/:versionId — edit draft content
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

  const supabase = getSupabase();
  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const { data: v } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .eq("agent_id", id)
    .limit(1)
    .maybeSingle();
  if (!v) return c.json({ error: "Not found" }, 404);
  if (v.published_at !== null) {
    return c.json(
      { error: "Cannot edit a published version. Create a new draft instead." },
      409
    );
  }

  const patch: Record<string, any> = {};
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

  await supabase.from("stored_agent_version").update(patch).eq("id", versionId);
  await supabase
    .from("stored_agent")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  const { data: updated } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .limit(1)
    .single();
  return c.json(serializeVersion(updated));
});

// POST /:id/versions/:versionId/publish
storedAgents.post("/:id/versions/:versionId/publish", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const versionId = validateParam(c.req.param("versionId"), "versionId");
  if (!id || !versionId) return c.json({ error: "Invalid id" }, 400);
  const supabase = getSupabase();

  const agent = await loadAgent(id, userId);
  if (!agent) return c.json({ error: "Not found" }, 404);

  const { data: v } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .eq("agent_id", id)
    .limit(1)
    .maybeSingle();
  if (!v) return c.json({ error: "Not found" }, 404);

  const now = new Date().toISOString();
  if (v.published_at === null) {
    await supabase
      .from("stored_agent_version")
      .update({ published_at: now })
      .eq("id", versionId);
  }
  await supabase
    .from("stored_agent")
    .update({ current_version_id: versionId, updated_at: now })
    .eq("id", id);

  const { data: updatedVersion } = await supabase
    .from("stored_agent_version")
    .select("*")
    .eq("id", versionId)
    .limit(1)
    .single();
  const updatedAgent = await loadAgent(id, userId);
  return c.json({
    agent: serializeAgent(updatedAgent!, updatedVersion),
    version: serializeVersion(updatedVersion),
  });
});

export default storedAgents;
