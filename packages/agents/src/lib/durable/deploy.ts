import type { ExperimentalZapierSdk } from "../zapier/sdk";
import { AGED_DURABLE_DEPS } from "./deps";
import type { AutomationTrigger } from "./types";

/**
 * Deploy / run / inspect durable automations against the experimental SDK
 * (foreman-l7xq). Every function takes the SDK client as a parameter so the layer
 * is testable with a fake; production passes `getExperimentalSdkForUser(userId)`.
 */

const SOURCE_FILE = "workflow.ts";

type Sdk = ExperimentalZapierSdk;

/** Every import in the durable source must be an aged-pinned dependency. */
function durableDependencies(): Record<string, string> {
  return { "@zapier/zapier-sdk": AGED_DURABLE_DEPS.sdk, zod: AGED_DURABLE_DEPS.zod };
}

function shapeConnections(
  connections?: Record<string, string | number>,
): Record<string, { connectionId: string | number }> | undefined {
  if (!connections) return undefined;
  const out: Record<string, { connectionId: string | number }> = {};
  for (const [alias, id] of Object.entries(connections)) out[alias] = { connectionId: id };
  return Object.keys(out).length ? out : undefined;
}

export function editorUrl(workflowId: string): string {
  return `https://zapier.com/durables-editor/${workflowId}`;
}

export interface DeployAutomationOptions {
  sdk: Sdk;
  name: string;
  description?: string;
  /** The durable workflow.ts source — `defineDurable(...)` + `export default`. */
  source: string;
  /** Connection alias → connection id, for every alias the source references. */
  connections?: Record<string, string | number>;
  /** Zapier app trigger to claim; omit for manual/webhook automations. */
  trigger?: AutomationTrigger;
  /** Publish enabled (default true). */
  enabled?: boolean;
  /** Private to the deploying account — EA default (default true). */
  isPrivate?: boolean;
}

export interface DeployResult {
  workflowId: string;
  versionId: string;
  enabled: boolean;
  isPrivate: boolean;
  editorUrl: string;
  triggerUrl: string;
  /** A trigger was requested + enabled, but the (async, silent) claim left it disabled. */
  triggerClaimFailed: boolean;
  disabledReason?: string | null;
}

/**
 * Create a workflow container + publish its first version. When a trigger is
 * requested with `enabled`, re-read the workflow to confirm the claim landed —
 * trigger claims are asynchronous and fail SILENTLY (publish returns ok, the
 * workflow stays disabled), most often from an unversioned `selectedApi`.
 */
export async function deployAutomation(opts: DeployAutomationOptions): Promise<DeployResult> {
  const {
    sdk,
    name,
    description,
    source,
    connections,
    trigger,
    enabled = true,
    isPrivate = true,
  } = opts;

  const created = await sdk.createWorkflow({ name, description, is_private: isPrivate });
  const workflowId = created.data.id;

  const version = await sdk.publishWorkflowVersion({
    workflow: workflowId,
    sourceFiles: { [SOURCE_FILE]: source },
    dependencies: durableDependencies(),
    zapierDurableVersion: AGED_DURABLE_DEPS.durable,
    enabled,
    connections: shapeConnections(connections),
    trigger: trigger
      ? {
          action: trigger.action,
          selectedApi: trigger.selectedApi,
          authenticationId: trigger.authenticationId ?? null,
          params: trigger.params,
        }
      : undefined,
  });

  let finalEnabled = enabled;
  let triggerClaimFailed = false;
  let disabledReason: string | null | undefined;
  if (trigger && enabled) {
    const wf = await sdk.getWorkflow({ workflow: workflowId });
    finalEnabled = wf.data.enabled;
    disabledReason = wf.data.disabled_reason ?? null;
    triggerClaimFailed = !wf.data.enabled;
  }

  return {
    workflowId,
    versionId: version.data.id,
    enabled: finalEnabled,
    isPrivate,
    editorUrl: editorUrl(workflowId),
    triggerUrl: created.data.trigger_url,
    triggerClaimFailed,
    disabledReason,
  };
}

/**
 * Run durable source once, ephemerally (no saved workflow) — the "test it before
 * you deploy" path. Returns immediately with a run id; poll `getDurableRunStatus`
 * until terminal.
 */
export async function runAutomationOnce(opts: {
  sdk: Sdk;
  source: string;
  input?: unknown;
  connections?: Record<string, string | number>;
}): Promise<{ runId: string; status: string }> {
  const r = await opts.sdk.runDurable({
    sourceFiles: { [SOURCE_FILE]: opts.source },
    input: opts.input,
    dependencies: durableDependencies(),
    zapierDurableVersion: AGED_DURABLE_DEPS.durable,
    connections: shapeConnections(opts.connections),
    private: true,
  });
  return { runId: r.data.id, status: r.data.status };
}

/** Manually fire a deployed workflow. Returns the trigger id (bridge via getTriggerRunStatus). */
export async function triggerAutomation(opts: {
  sdk: Sdk;
  workflowId: string;
  input?: unknown;
}): Promise<{ triggerId: string }> {
  const r = await opts.sdk.triggerWorkflow({ workflow: opts.workflowId, input: opts.input });
  return { triggerId: r.data.id };
}

/** One durable operation (step) that has retried or is failing — the actionable subset. */
export interface DurableOpDetail {
  name: string;
  type: string;
  status: string;
  retryCount: number;
  maxAttempts?: number;
  /** When the engine will retry this op next (ISO), while it's between attempts. */
  nextRetryAt?: string;
  error?: unknown;
}

/**
 * A human-approval callback gate the durable is paused on (foreman-rm8z). Surfaced
 * so the /automations UI can show "waiting for approval" + what payload is expected.
 * NOTE: the callback URL is minted INSIDE the durable by `ctx.createCallback` and is
 * not exposed here — `getDurableRun` only returns the token/schema — so resuming
 * (the approve/deny POST) is a separate, still-blocked capability (see the rm8z
 * follow-up). This is the read-only half.
 */
export interface DurableCallback {
  name: string;
  status: string;
  callbackToken?: string | null;
  payloadSchema?: unknown;
  /** When Zapier will auto-resume/expire the gate, if a deadline was set (ISO). */
  resumeAt?: string;
  expiresAt?: string;
}

/**
 * Compact in-flight view distilled from `getDurableRun.execution` (foreman-jc12 +
 * rm8z). The top-level run status stays "started" while a step RETRIES or the run
 * WAITS on a human callback, so the real signal lives here: `summary.last_error`,
 * the retrying/failed ops, and any pending approval gate. Null when the run is
 * executing cleanly (nothing to surface).
 */
export interface DurableRunDetail {
  totalAttempts?: number;
  lastError?: { code: string; title: string; detail?: string | null } | null;
  retrying: DurableOpDetail[];
  /** True when the durable is paused on a human-approval callback (execution.status = waiting). */
  waiting?: boolean;
  callbacks?: DurableCallback[];
}

type DurableExecution = NonNullable<Awaited<ReturnType<Sdk["getDurableRun"]>>["data"]["execution"]>;

function extractRunDetail(execution: DurableExecution | null): DurableRunDetail | null {
  if (!execution) return null;
  const ops = execution.operations ?? [];
  const retrying: DurableOpDetail[] = ops
    .filter((o) => o.retry_count > 0 || o.status === "failed" || o.status === "retrying")
    .map((o) => ({
      name: o.name,
      type: o.type,
      status: o.status,
      retryCount: o.retry_count,
      maxAttempts: o.max_attempts,
      nextRetryAt: o.next_retry_at,
      error: o.error,
    }));
  // Approval gates: ops carrying a callback_token are createCallback pauses.
  const callbacks: DurableCallback[] = ops
    .filter((o) => o.callback_token != null)
    .map((o) => ({
      name: o.name,
      status: o.status,
      callbackToken: o.callback_token,
      payloadSchema: o.payload_schema,
      resumeAt: o.resume_at,
      expiresAt: o.expires_at,
    }));
  const waiting = execution.status === "waiting";
  const lastError = execution.summary?.last_error ?? null;
  // Nothing actionable — a clean, still-running execution.
  if (!lastError && retrying.length === 0 && !waiting && callbacks.length === 0) return null;
  return {
    totalAttempts: execution.summary?.total_attempts,
    lastError,
    retrying,
    ...(waiting ? { waiting } : {}),
    ...(callbacks.length ? { callbacks } : {}),
  };
}

export async function getDurableRunStatus(
  sdk: Sdk,
  runId: string,
): Promise<{ status: string; output: unknown; error: unknown; detail: DurableRunDetail | null }> {
  const r = await sdk.getDurableRun({ run: runId });
  return {
    status: r.data.status,
    output: r.data.output,
    error: r.data.error,
    detail: extractRunDetail(r.data.execution),
  };
}

/** Cancel a running durable run. Returns the resulting status ("cancelled"). */
export async function cancelDurableRun(sdk: Sdk, runId: string): Promise<string> {
  const r = await sdk.cancelDurableRun({ run: runId });
  return r.data.status;
}

export interface ResolvedCallback {
  /** The callback endpoint to POST the approval/rejection payload to. A PUBLIC bearer URL — never expose to a browser. */
  url: string;
  /** The gate's name (the `ctx.createCallback` name). */
  name: string;
  payloadSchema?: unknown;
}

/**
 * Resolve a durable's human-approval callback URL from OUTSIDE, on demand
 * (foreman-zfnj). `getDurableRun` does NOT expose the URL on the callback op — it
 * is minted inside the durable and only surfaces if the durable REPORTS it via a
 * step whose result carries `{ callbackUrl, callbackName }` (Foreman's authoring
 * convention — see `buildApprovalDurableSource`). Reads the run's execution and
 * returns the URL for the named (or sole) still-pending callback, or null if the
 * run isn't waiting on that gate / never reported a URL. Resolved fresh each time
 * and never persisted, so the bearer URL never lands in Foreman's DB or the UI.
 */
export async function resolveCallbackUrl(
  sdk: Sdk,
  durableRunId: string,
  callbackName?: string,
): Promise<ResolvedCallback | null> {
  const r = await sdk.getDurableRun({ run: durableRunId });
  const execution = r.data.execution;
  if (!execution) return null;
  const ops = (execution.operations ?? []) as Array<{
    name: string;
    status: string;
    callback_token?: string | null;
    payload_schema?: unknown;
    result?: unknown;
  }>;

  // A callback gate is still open only while its op is pending/waiting.
  const pending = ops.filter(
    (o) => o.callback_token != null && (o.status === "pending" || o.status === "waiting"),
  );
  const gate = callbackName ? pending.find((o) => o.name === callbackName) : pending[0];
  if (!gate) return null;

  // The URL comes from the step the durable authored to report it.
  const reported = ops
    .map((o) => o.result as { callbackUrl?: string; callbackName?: string } | undefined)
    .find((res) => res?.callbackUrl && (!res.callbackName || res.callbackName === gate.name));
  if (!reported?.callbackUrl) return null;

  return { url: reported.callbackUrl, name: gate.name, payloadSchema: gate.payload_schema };
}

/** POST an approval/rejection payload to a durable callback URL (foreman-zfnj). */
export async function postCallback(
  url: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  return { ok: res.ok, status: res.status };
}

export async function getTriggerRunStatus(
  sdk: Sdk,
  triggerId: string,
): Promise<{ status: string; durableRunId: string | null; output: unknown; error: unknown }> {
  const r = await sdk.getTriggerRun({ trigger: triggerId });
  return {
    status: r.data.status,
    durableRunId: r.data.durable_run_id,
    output: r.data.output,
    error: r.data.error,
  };
}

export interface AutomationSummary {
  id: string;
  name: string;
  enabled: boolean;
  isPrivate: boolean;
  editorUrl: string;
  triggers: unknown;
}

export async function listAutomations(sdk: Sdk): Promise<AutomationSummary[]> {
  const res = await sdk.listWorkflows();
  return res.data.map((w) => ({
    id: w.id,
    name: w.name,
    enabled: w.enabled,
    isPrivate: w.is_private,
    editorUrl: editorUrl(w.id),
    triggers: w.triggers,
  }));
}

export async function inspectAutomation(
  sdk: Sdk,
  workflowId: string,
  maxRuns = 10,
): Promise<{ workflow: unknown; runs: unknown[] }> {
  const wf = await sdk.getWorkflow({ workflow: workflowId });
  const runs = await sdk.listWorkflowRuns({ workflow: workflowId, maxItems: maxRuns });
  return { workflow: wf.data, runs: runs.data };
}

export async function deleteAutomation(sdk: Sdk, workflowId: string): Promise<void> {
  await sdk.deleteWorkflow({ workflow: workflowId });
}

/** Enable or disable a deployed workflow on Zapier. Returns the resulting enabled state. */
export async function setAutomationEnabled(
  sdk: Sdk,
  workflowId: string,
  enabled: boolean,
): Promise<boolean> {
  const r = enabled
    ? await sdk.enableWorkflow({ workflow: workflowId })
    : await sdk.disableWorkflow({ workflow: workflowId });
  return r.data.enabled;
}
