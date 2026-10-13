import type { ExperimentalZapierSdk } from "../zapier/sdk";
import { AGED_DURABLE_DEPS } from "./deps";
import type { AutomationTrigger } from "./types";

/**
 * Deploy / run / inspect durable automations against the experimental SDK
 * (foreman-l7xq). Every function takes the SDK client as a parameter so the layer
 * is testable with a fake; production passes `getExperimentalSdkForUser(userId)`.
 */

const SOURCE_FILE = "workflow.ts";
/** Same file, absolute — `validateWorkflow` rejects anything without a leading `/`. */
const VALIDATE_FILE = `/${SOURCE_FILE}`;

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

/** One diagnostic from `validateWorkflow` — SDK 0.100.0. */
export interface DurableSourceIssue {
  kind: string;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  suggestion?: string;
  /** 1-based line in the durable source, when the diagnostic points at one. */
  line?: number;
}

/** Thrown by `deployAutomation` when the source fails validation before anything is created. */
export class DurableSourceInvalidError extends Error {
  constructor(readonly issues: DurableSourceIssue[]) {
    super(
      `Durable source failed validation:\n${issues
        .map(
          (i) =>
            `  ${i.line ? `line ${i.line}: ` : ""}${i.message}${i.suggestion ? ` — ${i.suggestion}` : ""}`,
        )
        .join("\n")}`,
    );
    this.name = "DurableSourceInvalidError";
  }
}

/**
 * Type-check durable source WITHOUT publishing it (SDK 0.100.0 `validateWorkflow`).
 *
 * `validateWorkflow` demands ABSOLUTE logical paths — both the `sourceFiles`
 * keys and `entrypointFile` must start with `/`, and it rejects the request
 * outright otherwise ("Invalid key in record" / "entrypointFile must start with
 * /"). `publishWorkflowVersion` and `runDurable` accept the relative
 * `workflow.ts`, so the two surfaces genuinely disagree; hence VALIDATE_FILE
 * alongside SOURCE_FILE rather than one shared constant.
 *
 * Best-effort by design. If the validate call fails — endpoint unavailable,
 * scope not granted — return no issues rather than blocking a deploy path that
 * worked before this pre-flight existed. That swallowing is why the path
 * mistake above went unnoticed until foreman-h54f called the SDK raw, so the
 * throw is logged rather than discarded silently.
 */
export async function validateAutomationSource(opts: {
  sdk: Sdk;
  source: string;
}): Promise<DurableSourceIssue[]> {
  let raw: Awaited<ReturnType<Sdk["validateWorkflow"]>>;
  try {
    raw = await opts.sdk.validateWorkflow({
      sourceFiles: { [VALIDATE_FILE]: opts.source },
      entrypointFile: VALIDATE_FILE,
    });
  } catch (err) {
    console.warn(
      `[durable] validateWorkflow pre-flight unavailable, deploying unvalidated: ${(err as Error).message}`,
    );
    return [];
  }
  return (raw.data.issues ?? []).map((i) => ({
    kind: i.kind,
    message: i.message,
    severity: i.severity,
    suggestion: i.suggestion,
    line: i.source?.start_line,
  }));
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
 *
 * Source is validated FIRST. `createWorkflow` runs before `publishWorkflowVersion`,
 * so source that fails to compile used to leave an orphan workflow container in
 * the user's account with no published version. Validating up front means bad
 * agent-generated source creates nothing at all.
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

  // Only `error` blocks. `kind` values are added over time, so an unfamiliar one
  // is a diagnostic, not a failure — severity is the thing to branch on.
  const blocking = (await validateAutomationSource({ sdk, source })).filter(
    (i) => i.severity === "error",
  );
  if (blocking.length) throw new DurableSourceInvalidError(blocking);

  const created = await sdk.createWorkflow({ name, description, is_private: isPrivate });
  const workflowId = created.data.id;

  const version = await sdk.publishWorkflowVersion({
    workflow: workflowId,
    sourceFiles: { [SOURCE_FILE]: source },
    dependencies: durableDependencies(),
    zapierDurableVersion: AGED_DURABLE_DEPS.durable,
    enabled,
    // A version must declare how it starts. Without a trigger, publish is
    // rejected outright: "No trigger is configured — set manual: true to run
    // this workflow on demand". Every trigger-less automation Foreman deploys
    // (manual + webhook) is exactly that case, so say so explicitly.
    manual: !trigger,
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

  // Agentic management reads the per-VERSION intent to judge proposed fixes, and a
  // freshly published version starts with none — so record what this version is
  // meant to do from the spec's description. Best-effort: the deploy already
  // succeeded, and a missing intent only weakens future heal/expand proposals.
  if (description?.trim()) {
    try {
      await sdk.updateAgenticManagementIntent({
        workflow: workflowId,
        version: version.data.id,
        intent: description.trim(),
      });
    } catch (err) {
      console.warn(
        `[durable] could not record agentic-management intent for ${workflowId}: ${(err as Error).message}`,
      );
    }
  }

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

/** Which kind of workflow run — a published version ("live") or a draft test run. */
export type WorkflowRunKind = "draft" | "live";

export interface DraftTestResult {
  kind: "draft";
  /** The workflow-run id (getWorkflowRun / listWorkflowRuns). */
  runId: string;
  status: string;
  /** Null until the engine links the durable execution. */
  durableRunId: string | null;
  draftId: string;
  draftRevision: number;
}

/**
 * Test durable source as a DRAFT run of an already-saved workflow (SDK 0.110.0
 * `runWorkflowDraft`). Forks a draft off the live version, saves `source` into
 * it, and launches a run of exactly that revision — nothing is published and the
 * live version is untouched. Draft runs are not task-charged, but they execute
 * the source for real: any `sdk.runAction` step hits the connected app.
 *
 * The run snapshots the draft's payload at creation, so the draft is discarded
 * right after launch (unless `keepDraft`): an open draft would otherwise make a
 * later `publishWorkflowVersion` 409 and linger in the user's editor. Like
 * `runAutomationOnce`, this returns as soon as the run is accepted ("initialized");
 * follow it with `getWorkflowRunStatus`.
 */
export async function testAutomationDraft(opts: {
  sdk: Sdk;
  workflowId: string;
  source: string;
  input?: unknown;
  connections?: Record<string, string | number>;
  keepDraft?: boolean;
}): Promise<DraftTestResult> {
  const { sdk, workflowId } = opts;
  const created = await sdk.createWorkflowDraft({ workflow: workflowId, slug: "foreman-test" });
  const draftId = created.data.id;
  try {
    const saved = await sdk.updateWorkflowDraft({
      workflow: workflowId,
      draft: draftId,
      sourceFiles: { [SOURCE_FILE]: opts.source },
      dependencies: durableDependencies(),
      zapierDurableVersion: AGED_DURABLE_DEPS.durable,
      // Optimistic concurrency against the revision we just forked.
      draftRevision: created.data.draft_revision,
      // Foreman owns the firing (inbox worker / scheduler), so every durable it
      // deploys is manual — keep the draft consistent with the live version.
      manual: true,
      connections: shapeConnections(opts.connections) ?? null,
    });
    const run = await sdk.runWorkflowDraft({
      workflow: workflowId,
      draft: draftId,
      draftRevision: saved.data.draft_revision,
      input: opts.input,
    });
    return {
      kind: "draft",
      runId: run.data.id,
      status: run.data.status,
      durableRunId: run.data.durable_run_id,
      draftId,
      draftRevision: run.data.draft_revision,
    };
  } finally {
    if (!opts.keepDraft) {
      await discardAutomationDraft(sdk, workflowId, draftId).catch((err) =>
        console.warn(
          `[durable] could not discard test draft ${draftId}: ${(err as Error).message}`,
        ),
      );
    }
  }
}

/** Soft-delete a workflow draft (status → discarded). */
export async function discardAutomationDraft(
  sdk: Sdk,
  workflowId: string,
  draftId: string,
): Promise<void> {
  await sdk.discardWorkflowDraft({ workflow: workflowId, draft: draftId });
}

/**
 * Publish an open draft as the workflow's new live version (consumes the draft).
 * Pass the `draftRevision` that was tested so a concurrent edit can't ship untested.
 */
export async function publishAutomationDraft(opts: {
  sdk: Sdk;
  workflowId: string;
  draftId: string;
  draftRevision?: number;
  enabled?: boolean;
}): Promise<{ versionId: string }> {
  const r = await opts.sdk.publishWorkflowDraft({
    workflow: opts.workflowId,
    draft: opts.draftId,
    draftRevision: opts.draftRevision,
    enabled: opts.enabled,
  });
  return { versionId: r.data.version.id };
}

/** Current state of a workflow run, live or draft (`kind` says which). */
export async function getWorkflowRunStatus(
  sdk: Sdk,
  runId: string,
  workflowId?: string,
): Promise<{
  kind: WorkflowRunKind;
  status: string;
  durableRunId: string | null;
  output: unknown;
  error: unknown;
}> {
  const r = await sdk.getWorkflowRun({ run: runId, workflow: workflowId });
  return {
    kind: r.data.kind,
    status: r.data.status,
    durableRunId: r.data.durable_run_id,
    output: r.data.output,
    error: r.data.error,
  };
}

/** One row of a workflow's run history with its kind made explicit. */
export interface WorkflowRunSummary {
  id: string;
  kind: WorkflowRunKind;
  status: string;
  durableRunId: string | null;
  input: unknown;
  error: unknown;
  createdAt: string;
  updatedAt: string;
  /** Live runs only. */
  triggerId?: string | null;
  workflowVersionId?: string | null;
  /** Draft runs only. */
  workflowDraftId?: string | null;
  draftRevision?: number;
}

type ListedWorkflowRun = Awaited<ReturnType<Sdk["listWorkflowRuns"]>>["data"][number];

function summarizeRun(r: ListedWorkflowRun): WorkflowRunSummary {
  const base = {
    id: r.id,
    // Pre-0.110 rows (and fakes) may omit kind — those were all live runs.
    kind: (r.kind ?? "live") as WorkflowRunKind,
    status: r.status,
    durableRunId: r.durable_run_id,
    input: r.input,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return r.kind === "draft"
    ? { ...base, workflowDraftId: r.workflow_draft_id, draftRevision: r.draft_revision }
    : { ...base, triggerId: r.trigger_id, workflowVersionId: r.workflow_version_id };
}

/** A workflow's runs, newest first. Omit `kind` for live + draft interleaved. */
export async function listWorkflowRunsByKind(
  sdk: Sdk,
  workflowId: string,
  opts: { kind?: WorkflowRunKind; maxItems?: number } = {},
): Promise<WorkflowRunSummary[]> {
  const res = await sdk.listWorkflowRuns({
    workflow: workflowId,
    maxItems: opts.maxItems ?? 10,
    ...(opts.kind ? { kind: opts.kind } : {}),
  });
  return res.data.map(summarizeRun);
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
      nextRetryAt: o.next_retry_at ?? undefined,
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
      resumeAt: o.resume_at ?? undefined,
      expiresAt: o.expires_at ?? undefined,
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

/**
 * Workflow + recent run history. Since SDK 0.110.0 the run list interleaves live
 * runs with free draft test runs; every run carries an explicit `kind`, and
 * `kind` narrows the list (pass "live" when only real executions count).
 */
export async function inspectAutomation(
  sdk: Sdk,
  workflowId: string,
  maxRuns = 10,
  kind?: WorkflowRunKind,
): Promise<{ workflow: unknown; runs: WorkflowRunSummary[] }> {
  const wf = await sdk.getWorkflow({ workflow: workflowId });
  const runs = await listWorkflowRunsByKind(sdk, workflowId, { kind, maxItems: maxRuns });
  return { workflow: wf.data, runs };
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

/** Agentic-management modes Foreman may set (the API may also report migrate/optimize). */
export type AgenticManagementMode = "heal" | "expand" | "harden";
export const AGENTIC_MANAGEMENT_MODES: readonly AgenticManagementMode[] = [
  "heal",
  "expand",
  "harden",
];

export interface AgenticManagementState {
  enabled: boolean;
  autoApprove: boolean;
  modes: string[];
  managerId: string | null;
  /** The live version's recorded intent; null if none (or unreadable). */
  intent: string | null;
}

/** Read a workflow's agentic-management config + the live version's intent. */
export async function getAutomationManagement(
  sdk: Sdk,
  workflowId: string,
): Promise<AgenticManagementState> {
  const cfg = await sdk.getAgenticManagementConfig({ workflow: workflowId });
  let intent: string | null = null;
  try {
    intent = (await sdk.getAgenticManagementIntent({ workflow: workflowId })).data.intent;
  } catch {
    // Intent is advisory; a failed read shouldn't hide the config.
  }
  return {
    enabled: cfg.data.enabled,
    autoApprove: cfg.data.auto_approve,
    modes: cfg.data.modes,
    managerId: cfg.data.manager_id ?? null,
    intent,
  };
}

export interface AgenticManagementPatch {
  /** true = enable, false = disable (settings are kept), omit = leave as is. */
  enabled?: boolean;
  /** Replaces the whole mode set. */
  modes?: AgenticManagementMode[];
  /** Apply proposed fixes without human approval. */
  autoApprove?: boolean;
  /** What the live version is meant to do. */
  intent?: string;
}

/**
 * Change a workflow's agentic management. Enabling always sends an explicit
 * `autoApprove` (default FALSE): the SDK treats an omitted value on first enable
 * as "apply fixes without asking", which contradicts Foreman's human-approval
 * model. Returns the resulting state.
 */
export async function setAutomationManagement(
  sdk: Sdk,
  workflowId: string,
  patch: AgenticManagementPatch,
): Promise<AgenticManagementState> {
  if (patch.enabled === true) {
    await sdk.enableAgenticManagement({
      workflow: workflowId,
      modes: patch.modes,
      autoApprove: patch.autoApprove ?? false,
    });
  } else {
    if (patch.enabled === false) await sdk.disableAgenticManagement({ workflow: workflowId });
    if (patch.modes !== undefined || patch.autoApprove !== undefined) {
      await sdk.updateAgenticManagementConfig({
        workflow: workflowId,
        modes: patch.modes,
        autoApprove: patch.autoApprove,
      });
    }
  }
  if (patch.intent?.trim()) {
    await sdk.updateAgenticManagementIntent({ workflow: workflowId, intent: patch.intent.trim() });
  }
  return getAutomationManagement(sdk, workflowId);
}
