import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import { desc, eq, and, asc } from "drizzle-orm";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";
import { executeWorkflow } from "@/lib/workflows/engine";
import { saveWorkflowFromConversation } from "@/lib/workflows/save";
import { extractParams } from "@/lib/workflows/params";

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
    const result = await saveWorkflowFromConversation(
      conversationId,
      userId,
      name,
      orgId
    );
    return c.json(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

// GET / — list workflows for current user
workflows.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.workflow)
    .where(eq(schema.workflow.userId, userId))
    .orderBy(desc(schema.workflow.updatedAt));

  return c.json(
    rows.map((w) => ({
      id: w.id,
      name: w.name,
      source_conversation_id: w.sourceConversationId,
      parameters: JSON.parse(w.parameters),
      created_at: w.createdAt.toISOString(),
      updated_at: w.updatedAt.toISOString(),
    }))
  );
});

// GET /:id — get workflow with steps
workflows.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.workflow)
    .where(
      and(eq(schema.workflow.id, id), eq(schema.workflow.userId, userId))
    )
    .limit(1);

  const wf = rows[0];
  if (!wf) {
    return c.json({ error: "Not found" }, 404);
  }

  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.workflowId, id))
    .orderBy(asc(schema.workflowStep.order));

  // Collect all live parameters from step templates
  const liveParams = new Set<string>();
  const parsedSteps = steps.map((s) => {
    const template = JSON.parse(s.proposalTemplate) as Record<string, unknown>;
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
      source_conversation_id: wf.sourceConversationId,
      parameters: [...liveParams],
      created_at: wf.createdAt.toISOString(),
      updated_at: wf.updatedAt.toISOString(),
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
  const db = getDb();

  // Verify ownership
  const wfRows = await db
    .select()
    .from(schema.workflow)
    .where(
      and(eq(schema.workflow.id, id), eq(schema.workflow.userId, userId))
    )
    .limit(1);

  if (!wfRows[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const runs = await db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.workflowId, id))
    .orderBy(desc(schema.workflowRun.createdAt));

  return c.json(
    runs.map((r) => ({
      id: r.id,
      workflow_id: r.workflowId,
      inputs: JSON.parse(r.inputs),
      status: r.status,
      created_at: r.createdAt.toISOString(),
      completed_at: r.completedAt?.toISOString() ?? null,
    }))
  );
});

// POST /:id/run — start a workflow run, stream SSE status updates
workflows.post("/:id/run", async (c) => {
  const userId = c.get("userId");
  const workflowId = validateParam(c.req.param("id"), "id");
  if (!workflowId) {
    return c.json({ error: "Invalid workflow id" }, 400);
  }
  const db = getDb();

  // Verify ownership
  const wfRows = await db
    .select()
    .from(schema.workflow)
    .where(
      and(
        eq(schema.workflow.id, workflowId),
        eq(schema.workflow.userId, userId)
      )
    )
    .limit(1);

  const wf = wfRows[0];
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

  // Guard against excessively large input payloads
  const inputsStr = JSON.stringify(inputs);
  if (inputsStr.length > 50000) {
    return c.json({ error: "inputs payload too large (max 50KB)" }, 400);
  }

  const orgId = c.get("orgId");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of executeWorkflow(
          workflowId,
          userId,
          inputs,
          orgId
        )) {
          controller.enqueue(encodeSSE(event as any));
        }
      } catch (err) {
        controller.enqueue(
          encodeSSE({
            type: "error",
            code: "WORKFLOW_RUN_ERROR",
            message: err instanceof Error ? err.message : String(err),
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  const headers = sseHeaders();
  return new Response(sseStream, { headers });
});

export default workflows;
