import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import { desc, eq, and, asc } from "drizzle-orm";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const workflows = new Hono<AppEnv>();

// All routes require auth
workflows.use("/*", authMiddleware);

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

  return c.json({
    workflow: {
      id: wf.id,
      name: wf.name,
      source_conversation_id: wf.sourceConversationId,
      parameters: JSON.parse(wf.parameters),
      created_at: wf.createdAt.toISOString(),
      updated_at: wf.updatedAt.toISOString(),
    },
    steps: steps.map((s) => ({
      id: s.id,
      order: s.order,
      proposal_template: JSON.parse(s.proposalTemplate),
    })),
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

  // Load steps
  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.workflowId, workflowId))
    .orderBy(asc(schema.workflowStep.order));

  // Create run record
  const runId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.workflowRun).values({
    id: runId,
    workflowId,
    inputs: JSON.stringify(inputs),
    status: "running",
    createdAt: now,
  });

  const sseStream = new ReadableStream({
    async start(controller) {
      // Send initial status
      controller.enqueue(
        encodeSSE({
          type: "status",
          runId,
          status: "running",
        } as any)
      );

      try {
        for (const step of steps) {
          // Notify step started
          controller.enqueue(
            encodeSSE({
              type: "step",
              runId,
              stepId: step.id,
              order: step.order,
              status: "running",
            } as any)
          );

          // Execute step (placeholder — actual execution would
          // invoke the action described in proposalTemplate)
          const template = JSON.parse(step.proposalTemplate);

          // Notify step complete
          controller.enqueue(
            encodeSSE({
              type: "step",
              runId,
              stepId: step.id,
              order: step.order,
              status: "complete",
              result: { template },
            } as any)
          );
        }

        // Mark run as success
        await db
          .update(schema.workflowRun)
          .set({ status: "success", completedAt: new Date() })
          .where(eq(schema.workflowRun.id, runId));

        controller.enqueue(
          encodeSSE({
            type: "complete",
            runId,
            status: "success",
          } as any)
        );
      } catch (err) {
        // Mark run as failed
        await db
          .update(schema.workflowRun)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(schema.workflowRun.id, runId));

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
