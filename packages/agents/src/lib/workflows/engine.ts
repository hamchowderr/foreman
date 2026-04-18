import { getDb, schema } from "@/lib/db";
import { runAction } from "@/lib/zapier/execution";
import { substituteParams, validateParams } from "./params";
import { eq, asc } from "drizzle-orm";

export interface WorkflowEvent {
  type: "status" | "step" | "complete" | "error" | "param_request";
  runId?: string;
  stepIndex?: number;
  stepId?: string;
  status?: string;
  label?: string;
  result?: unknown;
  error?: string;
  message?: string;
  missing?: string[];
}

/**
 * Execute a saved workflow, yielding SSE-friendly events as each step runs.
 */
export async function* executeWorkflow(
  workflowId: string,
  userId: string,
  inputs: Record<string, string>,
  orgId?: string
): AsyncGenerator<WorkflowEvent> {
  const db = getDb();

  // Load steps ordered
  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.workflowId, workflowId))
    .orderBy(asc(schema.workflowStep.order));

  if (steps.length === 0) {
    yield { type: "error", message: "Workflow has no steps" };
    return;
  }

  // Check all parameters are satisfied across all steps
  for (const step of steps) {
    const template = JSON.parse(step.proposalTemplate) as Record<string, unknown>;
    const inputsTemplate = (template.inputs ?? {}) as Record<string, unknown>;
    const { valid, missing } = validateParams(inputsTemplate, inputs);
    if (!valid) {
      yield { type: "param_request", missing };
      return;
    }
  }

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

  yield { type: "status", runId, status: "running" };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const template = JSON.parse(step.proposalTemplate) as Record<string, unknown>;
    const label = (template.humanLabel as string) ?? `Step ${i + 1}`;

    yield {
      type: "step",
      runId,
      stepIndex: i,
      stepId: step.id,
      status: "running",
      label,
    };

    try {
      // Substitute params into the action inputs
      const rawInputs = (template.inputs ?? {}) as Record<string, unknown>;
      const resolved = substituteParams(rawInputs, inputs);

      const result = await runAction(
        userId,
        template.appKey as string,
        template.actionType as string,
        template.actionKey as string,
        resolved,
        template.connectionId as string | undefined
      );

      yield {
        type: "step",
        runId,
        stepIndex: i,
        stepId: step.id,
        status: "complete",
        label,
        result,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      yield {
        type: "step",
        runId,
        stepIndex: i,
        stepId: step.id,
        status: "failed",
        label,
        error: errorMsg,
      };

      // Mark run as failed
      await db
        .update(schema.workflowRun)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(schema.workflowRun.id, runId));

      yield { type: "error", runId, message: errorMsg };
      return;
    }
  }

  // All steps succeeded
  await db
    .update(schema.workflowRun)
    .set({ status: "success", completedAt: new Date() })
    .where(eq(schema.workflowRun.id, runId));

  yield { type: "complete", runId, status: "success" };
}
