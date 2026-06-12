import { Hono } from "hono";
import { getSupabase } from "@/lib/db";
import type { Database } from "@/lib/db/database.types";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import { validateParam } from "@/lib/validation";
import { executeWorkflow } from "@/lib/workflows/engine";
import { extractParams } from "@/lib/workflows/params";
import { saveWorkflowFromConversation } from "@/lib/workflows/save";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const workflows = new Hono<AppEnv>();

// All routes require auth
workflows.use("/*", authMiddleware);

// POST / — create workflow from a conversation
workflows.post("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { conversationId, name } = body;
  if (!conversationId || typeof conversationId !== "string") {
    return c.json({ error: "conversationId is required" }, 400);
  }
  if (!name || typeof name !== "string" || name.length > 200) {
    return c.json({ error: "name is required (max 200 chars)" }, 400);
  }

  try {
    const result = await saveWorkflowFromConversation(conversationId, userId, name, orgId);
    return c.json(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

// GET / — list workflows for current user
workflows.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  const { data: rows } = await supabase
    .from("workflow")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return c.json(
    (rows ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      source_conversation_id: w.source_conversation_id,
      parameters: JSON.parse(w.parameters),
      created_at: w.created_at,
      updated_at: w.updated_at,
    })),
  );
});

// GET /templates — list all public workflow templates
workflows.get("/templates", async (c) => {
  const supabase = getSupabase();

  const { data: rows } = await supabase
    .from("workflow")
    .select("*")
    .eq("is_template", true)
    .order("updated_at", { ascending: false });

  return c.json(
    (rows ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      owner_user_id: w.user_id,
      parameters: JSON.parse(w.parameters),
      created_at: w.created_at,
      updated_at: w.updated_at,
    })),
  );
});

// DELETE /:id — irreversible. Cascades to workflow_step + workflow_run.
workflows.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const supabase = getSupabase();

  // Verify ownership before deleting anything
  const { data: existing } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }

  // Cascade manually: runs → steps → workflow.
  // (FK cascade isn't declared on the schema today; explicit delete keeps
  // the data path obvious and avoids surprises if migrations diverge.)
  await supabase.from("workflow_run").delete().eq("workflow_id", id);
  await supabase.from("workflow_step").delete().eq("workflow_id", id);
  await supabase.from("workflow").delete().eq("id", id);

  return c.json({ ok: true, id });
});

// PATCH /:id — update workflow metadata
workflows.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("workflow")
    .select("id, is_template")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }

  const patch: Database["public"]["Tables"]["workflow"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_template === "boolean") {
    patch.is_template = body.is_template;
  }
  if (typeof body.name === "string" && body.name.trim().length > 0) {
    patch.name = body.name.trim();
  }

  await supabase.from("workflow").update(patch).eq("id", id);

  return c.json({ ok: true, id, ...patch });
});

// POST /:id/clone — clone a template into caller's workspace
workflows.post("/:id/clone", async (c) => {
  const userId = c.get("userId");
  const sourceId = validateParam(c.req.param("id"), "id");
  if (!sourceId) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const supabase = getSupabase();

  const { data: source } = await supabase
    .from("workflow")
    .select("*")
    .eq("id", sourceId)
    .limit(1)
    .maybeSingle();

  if (!source) {
    return c.json({ error: "Not found" }, 404);
  }

  if (!source.is_template && source.user_id !== userId) {
    return c.json({ error: "Workflow is not a public template" }, 403);
  }

  const { data: sourceSteps } = await supabase
    .from("workflow_step")
    .select("*")
    .eq("workflow_id", sourceId)
    .order("order", { ascending: true });

  const newWorkflowId = crypto.randomUUID();
  const now = new Date().toISOString();

  await supabase.from("workflow").insert({
    id: newWorkflowId,
    user_id: userId,
    name: source.name,
    source_conversation_id: null,
    parameters: source.parameters,
    is_template: false,
    cloned_from: sourceId,
    created_at: now,
    updated_at: now,
  });

  const newSteps = (sourceSteps ?? []).map((s: any) => {
    const template = JSON.parse(s.proposal_template) as Record<string, unknown>;
    const rawConnection = template.connectionId;
    if (
      typeof rawConnection === "number" ||
      (typeof rawConnection === "string" && /^\d+$/.test(rawConnection))
    ) {
      delete template.connectionId;
    }
    return {
      id: crypto.randomUUID(),
      workflow_id: newWorkflowId,
      order: s.order,
      proposal_template: JSON.stringify(template),
    };
  });

  if (newSteps.length > 0) {
    await supabase.from("workflow_step").insert(newSteps);
  }

  return c.json({ id: newWorkflowId, cloned_from: sourceId }, 201);
});

// GET /:id — get workflow with steps
workflows.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const supabase = getSupabase();

  const { data: wf } = await supabase
    .from("workflow")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!wf) {
    return c.json({ error: "Not found" }, 404);
  }

  const { data: steps } = await supabase
    .from("workflow_step")
    .select("*")
    .eq("workflow_id", id)
    .order("order", { ascending: true });

  const liveParams = new Set<string>();
  const parsedSteps = (steps ?? []).map((s: any) => {
    const template = JSON.parse(s.proposal_template) as Record<string, unknown>;
    const inputs = (template.inputs ?? {}) as Record<string, unknown>;
    for (const p of extractParams(inputs)) {
      liveParams.add(p);
    }
    return { id: s.id, order: s.order, proposal_template: template };
  });

  return c.json({
    workflow: {
      id: wf.id,
      name: wf.name,
      source_conversation_id: wf.source_conversation_id,
      parameters: [...liveParams],
      created_at: wf.created_at,
      updated_at: wf.updated_at,
    },
    steps: parsedSteps,
  });
});

// GET /:id/runs — list past runs
workflows.get("/:id/runs", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const supabase = getSupabase();

  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!wf) {
    return c.json({ error: "Not found" }, 404);
  }

  const { data: runs } = await supabase
    .from("workflow_run")
    .select("*")
    .eq("workflow_id", id)
    .order("created_at", { ascending: false });

  return c.json(
    (runs ?? []).map((r: any) => ({
      id: r.id,
      workflow_id: r.workflow_id,
      inputs: JSON.parse(r.inputs),
      status: r.status,
      created_at: r.created_at,
      completed_at: r.completed_at ?? null,
      error_message: r.error_message ?? null,
      fired_by: r.fired_by ?? null,
      trigger_id: r.trigger_id ?? null,
    })),
  );
});

// POST /:id/run — start a workflow run, stream SSE status updates
workflows.post("/:id/run", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  if (!workflowId) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const supabase = getSupabase();

  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!wf) {
    return c.json({ error: "Not found" }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const inputs = body.inputs ?? {};

  const inputsStr = JSON.stringify(inputs);
  if (inputsStr.length > 50000) {
    return c.json({ error: "inputs payload too large (max 50KB)" }, 400);
  }

  const orgId = c.get("orgId");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of executeWorkflow(workflowId, userId, inputs, orgId)) {
          controller.enqueue(encodeSSE(event as any));
        }
      } catch (err) {
        controller.enqueue(
          encodeSSE({
            type: "error",
            code: "WORKFLOW_RUN_ERROR",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  const headers = sseHeaders();
  return new Response(sseStream, { headers });
});

// ─── Triggers ─────────────────────────────────────────────────────────────
//
// Triggers bind a saved workflow to an external event source. Three types:
//   cron     — scheduled (config: { schedule, timezone? })
//   channel  — chat-channel match (config: { channel, match })
//   poll     — Zapier read action diffed by dedupeKey (deferred)
//
// Cron + poll are driven by a worker process. Channel triggers are matched
// in-line by the channel webhook handlers. The agent uses these routes via
// attach_trigger / list_workflow_triggers / detach_trigger tools.

const TRIGGER_TYPES = new Set(["cron", "channel", "poll"]);

// POST /:id/triggers — attach a trigger to a workflow
workflows.post("/:id/triggers", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  if (!workflowId) return c.json({ error: "Invalid workflow id" }, 400);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { type, config, enabled } = body;
  if (typeof type !== "string" || !TRIGGER_TYPES.has(type)) {
    return c.json({ error: "type must be one of: cron, channel, poll" }, 400);
  }
  if (!config || typeof config !== "object") {
    return c.json({ error: "config (object) is required" }, 400);
  }

  const supabase = getSupabase();
  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!wf) return c.json({ error: "Not found" }, 404);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("workflow_trigger").insert({
    id,
    workflow_id: workflowId,
    type,
    config: JSON.stringify(config),
    enabled: typeof enabled === "boolean" ? enabled : true,
    created_at: now,
    updated_at: now,
  });
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ id, type, config, enabled: enabled !== false }, 201);
});

// GET /:id/triggers — list triggers for a workflow
workflows.get("/:id/triggers", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  if (!workflowId) return c.json({ error: "Invalid workflow id" }, 400);

  const supabase = getSupabase();
  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!wf) return c.json({ error: "Not found" }, 404);

  const { data: rows } = await supabase
    .from("workflow_trigger")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: true });

  return c.json(
    (rows ?? []).map((t: any) => ({
      id: t.id,
      type: t.type,
      config: JSON.parse(t.config),
      enabled: t.enabled,
      lastFiredAt: t.last_fired_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
  );
});

// PATCH /:id/triggers/:triggerId — toggle a trigger's enabled flag
workflows.patch("/:id/triggers/:triggerId", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  const triggerId = validateParam(c.req.param("triggerId"), "triggerId");
  if (!workflowId || !triggerId) return c.json({ error: "Invalid id" }, 400);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled (boolean) is required" }, 400);
  }

  const supabase = getSupabase();
  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!wf) return c.json({ error: "Not found" }, 404);

  await supabase
    .from("workflow_trigger")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", triggerId)
    .eq("workflow_id", workflowId);

  return c.json({ ok: true, id: triggerId, enabled: body.enabled });
});

// DELETE /:id/triggers/:triggerId — detach a trigger
workflows.delete("/:id/triggers/:triggerId", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  const triggerId = validateParam(c.req.param("triggerId"), "triggerId");
  if (!workflowId || !triggerId) return c.json({ error: "Invalid id" }, 400);

  const supabase = getSupabase();
  // Ownership check via workflow → user
  const { data: wf } = await supabase
    .from("workflow")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!wf) return c.json({ error: "Not found" }, 404);

  await supabase
    .from("workflow_trigger")
    .delete()
    .eq("id", triggerId)
    .eq("workflow_id", workflowId);

  return c.json({ ok: true, id: triggerId });
});

export default workflows;
