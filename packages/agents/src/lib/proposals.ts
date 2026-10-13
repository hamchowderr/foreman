import { getSupabase } from "./db";

export async function loadOwnedProposal(proposalId: string, userId: string) {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("action_proposal")
    .select("*, conversation!inner(user_id)")
    .eq("id", proposalId)
    .limit(1)
    .single();

  if (!data || (data.conversation as any).user_id !== userId) {
    return null;
  }

  // Return proposal fields without the joined conversation
  const { conversation: _conv, ...proposal } = data as any;
  return proposal;
}

/**
 * The generated Zapier tool an approved proposal executes. This used to match
 * `"execute_action"` — a tool name from the old hand-written executor that no
 * longer exists (only stale aimock fixtures still mention it). The generated
 * tool is `run-action`, so the branch below never fired: approving a proposal
 * ran the action but never wrote its `action_run` row, never flipped the
 * proposal to `executed`, never indexed it for RAG and never emitted
 * `action-executed` to the client.
 */
export const PROPOSAL_EXECUTION_TOOL = "run-action";

/**
 * The generated tools don't throw on failure — `handleSdkError` / a guardrail
 * denial come back as a normal tool-result shaped `{ error, code, retryable }`.
 * Recognise that so a failed run isn't recorded as executed.
 */
export function toolResultError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const { error, code } = result as { error?: unknown; code?: unknown };
  return typeof error === "string" && typeof code === "string" ? error : null;
}

/**
 * The action_run.result JSON for a run-action tool result. Carries the Zapier
 * action-run id (`meta.id`, SDK 0.114.2) as `zapier_run_id` inside the existing
 * JSON column — no schema change. The summarizer in zapier-sdk-tools already
 * lifts it to `zapier_run_id`; `meta.id` is the fallback for an unsummarized
 * result.
 */
export function actionRunResultJson(toolResult: unknown): string {
  if (!toolResult || typeof toolResult !== "object" || Array.isArray(toolResult)) {
    return JSON.stringify(toolResult);
  }
  const r = toolResult as { zapier_run_id?: unknown; meta?: { id?: unknown } };
  const runId =
    typeof r.zapier_run_id === "string"
      ? r.zapier_run_id
      : typeof r.meta?.id === "string"
        ? r.meta.id
        : undefined;
  return JSON.stringify(runId ? { ...toolResult, zapier_run_id: runId } : toolResult);
}
