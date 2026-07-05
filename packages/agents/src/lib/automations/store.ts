import { randomUUID } from "node:crypto";
import { getSupabase } from "../db";

/**
 * Automation persistence (foreman-l7xq M2). A SHARED workspace resource — all
 * reads/writes are scoped by workspace_id ("shared resources, private chats").
 * Zapier remains the execution store; these rows are Foreman's index of the
 * workspace's automations + their run history (and the idempotency store the
 * inbox worker uses in M3). Service-role access only (matches artifact).
 */

export interface AutomationRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  zapier_workflow_id: string;
  zapier_version_id: string | null;
  source: string;
  connections: Record<string, string | number>;
  trigger: Record<string, unknown> | null;
  trigger_inbox_id: string | null;
  enabled: boolean;
  status: string;
  editor_url: string | null;
  trigger_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunRow {
  id: string;
  automation_id: string;
  workspace_id: string | null;
  inbox_message_id: string | null;
  trigger_id: string | null;
  durable_run_id: string | null;
  workflow_version_id: string | null;
  status: string;
  input: unknown;
  output: unknown;
  error: unknown;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationInput {
  userId: string;
  workspaceId: string | null;
  name: string;
  description?: string | null;
  zapierWorkflowId: string;
  zapierVersionId?: string | null;
  source: string;
  connections?: Record<string, string | number>;
  trigger?: Record<string, unknown> | null;
  triggerInboxId?: string | null;
  enabled?: boolean;
  status?: string;
  editorUrl?: string | null;
  triggerUrl?: string | null;
}

export async function createAutomation(input: CreateAutomationInput): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("automation").insert({
    id,
    user_id: input.userId,
    workspace_id: input.workspaceId,
    name: input.name,
    description: input.description ?? null,
    zapier_workflow_id: input.zapierWorkflowId,
    zapier_version_id: input.zapierVersionId ?? null,
    source: input.source,
    connections: input.connections ?? {},
    trigger: (input.trigger ?? null) as never,
    trigger_inbox_id: input.triggerInboxId ?? null,
    enabled: input.enabled ?? false,
    status: input.status ?? "active",
    editor_url: input.editorUrl ?? null,
    trigger_url: input.triggerUrl ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`createAutomation failed: ${error.message}`);
  return id;
}

export async function listAutomations(workspaceId: string | undefined): Promise<AutomationRow[]> {
  if (!workspaceId) return [];
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as unknown as AutomationRow[];
}

export async function getAutomation(
  workspaceId: string | undefined,
  id: string,
): Promise<AutomationRow | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as AutomationRow) ?? null;
}

/**
 * All enabled, inbox-triggered automations across workspaces — the worker's work
 * list (M3). Inbox-triggered = the trigger jsonb carries an app + action.
 */
export async function listActiveInboxAutomations(): Promise<AutomationRow[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .select("*")
    .eq("enabled", true)
    .not("trigger", "is", null);
  const rows = (data ?? []) as unknown as AutomationRow[];
  return rows.filter((r) => {
    const t = r.trigger as { app?: unknown; action?: unknown } | null;
    return !!t && typeof t.app === "string" && typeof t.action === "string";
  });
}

/** Reverse lookup used by the inbox worker (M3) to resolve a Zapier workflow to its automation. */
export async function getAutomationByZapierWorkflowId(
  zapierWorkflowId: string,
): Promise<AutomationRow | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .select("*")
    .eq("zapier_workflow_id", zapierWorkflowId)
    .maybeSingle();
  return (data as unknown as AutomationRow) ?? null;
}

export interface AutomationPatch {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  status?: string;
  zapierVersionId?: string | null;
  source?: string;
  connections?: Record<string, string | number>;
  trigger?: Record<string, unknown> | null;
  triggerInboxId?: string | null;
  editorUrl?: string | null;
  triggerUrl?: string | null;
}

export async function updateAutomation(
  workspaceId: string | undefined,
  id: string,
  patch: AutomationPatch,
): Promise<boolean> {
  if (!workspaceId) return false;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.zapierVersionId !== undefined) row.zapier_version_id = patch.zapierVersionId;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.connections !== undefined) row.connections = patch.connections;
  if (patch.trigger !== undefined) row.trigger = patch.trigger;
  if (patch.triggerInboxId !== undefined) row.trigger_inbox_id = patch.triggerInboxId;
  if (patch.editorUrl !== undefined) row.editor_url = patch.editorUrl;
  if (patch.triggerUrl !== undefined) row.trigger_url = patch.triggerUrl;

  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .update(row as never)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  return !!data;
}

/** Delete the automation row (workspace-scoped) and return it so the caller can clean up Zapier. */
export async function deleteAutomation(
  workspaceId: string | undefined,
  id: string,
): Promise<AutomationRow | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return (data as unknown as AutomationRow) ?? null;
}

// ─── Runs ───

export interface RecordRunInput {
  automationId: string;
  workspaceId: string | null;
  inboxMessageId?: string | null;
  triggerId?: string | null;
  durableRunId?: string | null;
  workflowVersionId?: string | null;
  status?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

export async function recordRun(input: RecordRunInput): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("automation_run").insert({
    id,
    automation_id: input.automationId,
    workspace_id: input.workspaceId,
    inbox_message_id: input.inboxMessageId ?? null,
    trigger_id: input.triggerId ?? null,
    durable_run_id: input.durableRunId ?? null,
    workflow_version_id: input.workflowVersionId ?? null,
    status: input.status ?? "initialized",
    input: (input.input ?? null) as never,
    output: (input.output ?? null) as never,
    error: (input.error ?? null) as never,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`recordRun failed: ${error.message}`);
  return id;
}

/**
 * Idempotently claim a trigger-inbox message for an automation (M3 dedup). Inserts
 * a run keyed by (automation_id, inbox_message_id); a duplicate delivery hits the
 * unique index and returns null — the worker then skips it instead of re-running.
 */
export async function claimInboxMessage(input: {
  automationId: string;
  workspaceId: string | null;
  inboxMessageId: string;
}): Promise<string | null> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("automation_run")
    .insert({
      id,
      automation_id: input.automationId,
      workspace_id: input.workspaceId,
      inbox_message_id: input.inboxMessageId,
      status: "initialized",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null; // unique violation → already claimed
    throw new Error(`claimInboxMessage failed: ${error.message}`);
  }
  return data ? id : null;
}

export interface RunPatch {
  status?: string;
  durableRunId?: string | null;
  triggerId?: string | null;
  workflowVersionId?: string | null;
  output?: unknown;
  error?: unknown;
}

export async function updateRun(id: string, patch: RunPatch): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.durableRunId !== undefined) row.durable_run_id = patch.durableRunId;
  if (patch.triggerId !== undefined) row.trigger_id = patch.triggerId;
  if (patch.workflowVersionId !== undefined) row.workflow_version_id = patch.workflowVersionId;
  if (patch.output !== undefined) row.output = patch.output;
  if (patch.error !== undefined) row.error = patch.error;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("automation_run")
    .update(row as never)
    .eq("id", id);
  if (error) throw new Error(`updateRun failed: ${error.message}`);
}

export async function listRuns(
  workspaceId: string | undefined,
  automationId: string,
  limit = 20,
): Promise<AutomationRunRow[]> {
  if (!workspaceId) return [];
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation_run")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("automation_id", automationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as AutomationRunRow[];
}

/**
 * automation_run.status vocabulary:
 *   initialized → claimed (claimInboxMessage), not yet fired
 *   started     → durable triggered + executing (dispatch sets this; the durable's
 *                 own run is the authority — its trigger run status stays "started"
 *                 the whole time, so we reconcile against getDurableRun, not it)
 *   retrying    → a step is mid-retry (foreman-jc12); top-level durable status is
 *                 still "started" but execution.detail carries last_error + the ops.
 *                 Non-terminal — reconcile keeps polling until it clears/finishes.
 *   finished    → durable completed (reconcile)
 *   failed      → durable failed, or a dispatch error (reconcile / dispatch catch)
 */
export const TERMINAL_RUN_STATUSES = ["finished", "failed"] as const;
const NON_TERMINAL_RUN_STATUSES = ["initialized", "started", "retrying"];

/**
 * Non-terminal runs across all automations — the reconcile work list
 * (foreman-480k). Includes "initialized" rows with no trigger_id (a worker that
 * crashed between claim and dispatch) so the reconcile's stuck-run cap can fail
 * them; normal rows clear within the same cycle, so these are only crash debris.
 */
export async function listPendingRuns(limit = 200): Promise<AutomationRunRow[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("automation_run")
    .select("*")
    .in("status", NON_TERMINAL_RUN_STATUSES)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as AutomationRunRow[];
}

/** Resolve a set of automations by id (the reconcile needs each run's owner for SDK auth). */
export async function getAutomationsByIds(ids: string[]): Promise<AutomationRow[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabase();
  const { data } = await supabase.from("automation").select("*").in("id", ids);
  return (data ?? []) as unknown as AutomationRow[];
}
