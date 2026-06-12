import { getSupabase } from "@/lib/db";
import { runAction } from "@/lib/zapier/execution";
import { substituteParams, validateParams } from "./params";

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
  _orgId?: string,
): AsyncGenerator<WorkflowEvent> {
  const supabase = getSupabase();

  // Load steps ordered
  const { data: steps } = await supabase
    .from("workflow_step")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("order", { ascending: true });

  if (!steps || steps.length === 0) {
    yield { type: "error", message: "Workflow has no steps" };
    return;
  }

  // Check all parameters are satisfied across all steps
  for (const step of steps) {
    const template = JSON.parse(step.proposal_template) as Record<string, unknown>;
    const inputsTemplate = (template.inputs ?? {}) as Record<string, unknown>;
    const { valid, missing } = validateParams(inputsTemplate, inputs);
    if (!valid) {
      yield { type: "param_request", missing };
      return;
    }
  }

  // Create run record
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  await supabase.from("workflow_run").insert({
    id: runId,
    workflow_id: workflowId,
    inputs: JSON.stringify(inputs),
    status: "running",
    created_at: now,
  });

  // Own the run's terminal state in a try/finally so the row can never get
  // stuck in 'running'. `settled` flips at each terminal write (step failure or
  // success). The finally catches the cases the old code missed: the caller
  // abandons the generator mid-stream (for-await break → generator .return()),
  // or an unexpected error propagates out of a step. The status yield lives
  // inside the try so an abandon at any point after the row exists is covered.
  // (foreman-2afc)
  let settled = false;
  try {
    yield { type: "status", runId, status: "running" };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const template = JSON.parse(step.proposal_template) as Record<string, unknown>;
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
        const rawInputs = (template.inputs ?? {}) as Record<string, unknown>;
        const resolved = substituteParams(rawInputs, inputs);

        const result = await runAction(
          userId,
          template.appKey as string,
          template.actionType as string,
          template.actionKey as string,
          resolved,
          template.connectionId as string | undefined,
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

        await supabase
          .from("workflow_run")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", runId);
        settled = true;

        yield { type: "error", runId, message: errorMsg };
        return;
      }
    }

    // All steps succeeded
    await supabase
      .from("workflow_run")
      .update({ status: "success", completed_at: new Date().toISOString() })
      .eq("id", runId);
    settled = true;

    yield { type: "complete", runId, status: "success" };
  } finally {
    if (!settled) {
      try {
        await supabase
          .from("workflow_run")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", runId);
      } catch (e) {
        console.error(`[engine] failed to mark abandoned run ${runId} failed:`, e);
      }
    }
  }
}
