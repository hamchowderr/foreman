import {
  cancelDurableRun,
  deleteAutomation as deleteZapierWorkflow,
  deployAutomation,
  getTriggerRunStatus,
  postCallback,
  resolveCallbackUrl,
  setAutomationEnabled,
  triggerAutomation,
} from "../durable";
import type { DeployResult } from "../durable/deploy";
import { resolveActiveWorkspace } from "../identity";
import { getInbox, listInboxMessages } from "../trigger-inbox";
import { type ExperimentalZapierSdk, getExperimentalSdkForUser } from "../zapier/sdk";
import { type InboxPriority, scoreInboxEntry } from "./inbox-priority";
import type { AutomationRow, AutomationRunRow } from "./store";
import * as store from "./store";
import type { InboxTriggerSpec } from "./types";

/**
 * Automation orchestration (foreman-l7xq M2). Composes the durable deploy/run
 * layer (M1) with workspace-scoped persistence (store), so the agent tools and
 * the web routes share one code path. Workspace is resolved from the user's
 * active workspace when a caller doesn't pass one explicitly.
 */

function statusFor(deployed: DeployResult): string {
  if (deployed.triggerClaimFailed) return "trigger_claim_failed";
  return deployed.enabled ? "active" : "disabled";
}

export interface ProvisionInput {
  userId: string;
  /** Explicit workspace (web route); falls back to the user's active workspace. */
  workspaceId?: string | null;
  name: string;
  description?: string;
  source: string;
  connections?: Record<string, string | number>;
  /** Trigger-inbox subscription that fires this automation; omit for manual. The
   *  worker (M3) arms the inbox idempotently on its next cycle. */
  trigger?: InboxTriggerSpec;
  enabled?: boolean;
  isPrivate?: boolean;
}

export interface ProvisionResult extends DeployResult {
  /** The Foreman automation id (the workspace-scoped record). */
  id: string;
}

/** Deploy a durable automation to Zapier and persist it as a workspace resource. */
export async function provisionAutomation(input: ProvisionInput): Promise<ProvisionResult> {
  const workspaceId = input.workspaceId ?? (await resolveActiveWorkspace(input.userId));
  const sdk = await getExperimentalSdkForUser(input.userId);

  // Deploy as a manual durable (no Zapier-claimed trigger). Triggering is the
  // inbox worker's job (the locked design — Foreman owns the lease/ack loop).
  const deployed = await deployAutomation({
    sdk,
    name: input.name,
    description: input.description,
    source: input.source,
    connections: input.connections,
    enabled: input.enabled,
    isPrivate: input.isPrivate,
  });

  const id = await store.createAutomation({
    userId: input.userId,
    workspaceId: workspaceId ?? null,
    name: input.name,
    description: input.description ?? null,
    zapierWorkflowId: deployed.workflowId,
    zapierVersionId: deployed.versionId,
    source: input.source,
    connections: input.connections,
    trigger: input.trigger ? { ...input.trigger } : null,
    enabled: deployed.enabled,
    status: statusFor(deployed),
    editorUrl: deployed.editorUrl,
    triggerUrl: deployed.triggerUrl,
  });

  return { id, ...deployed };
}

export async function listForUser(userId: string): Promise<AutomationRow[]> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  return store.listAutomations(workspaceId);
}

export async function inspectForUser(
  userId: string,
  automationId: string,
  maxRuns = 20,
): Promise<{ automation: AutomationRow; runs: AutomationRunRow[] } | null> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const automation = await store.getAutomation(workspaceId, automationId);
  if (!automation) return null;
  const runs = await store.listRuns(workspaceId, automationId, maxRuns);
  return { automation, runs };
}

export interface InboxView {
  /** Live trigger-inbox state, or null if the worker hasn't armed it yet. */
  inbox: Awaited<ReturnType<typeof getInbox>> | null;
  /** Recent leased/queued messages (metadata + lease_count / possible_duplicate_data). */
  messages: Awaited<ReturnType<typeof listInboxMessages>>;
}

/** Live trigger-inbox view for an automation (the inbox-visibility panel). Null if not found. */
export async function getInboxView(
  userId: string,
  automationId: string,
): Promise<InboxView | null> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const automation = await store.getAutomation(workspaceId, automationId);
  if (!automation) return null;
  if (!automation.trigger_inbox_id) return { inbox: null, messages: [] };

  const sdk = await getExperimentalSdkForUser(userId);
  const [inbox, messages] = await Promise.all([
    getInbox(sdk, automation.trigger_inbox_id),
    listInboxMessages(sdk, automation.trigger_inbox_id, 20),
  ]);
  return { inbox, messages };
}

export interface WorkspaceInboxEntry {
  automation: Pick<AutomationRow, "id" | "name" | "enabled" | "trigger" | "status">;
  /** Which workspace member owns this automation (foreman-6r9y teammate aggregation). */
  owner: { userId: string; isSelf: boolean };
  inbox: InboxView["inbox"];
  messages: InboxView["messages"];
  /** Importance/urgency ranking for the "what needs attention" view (foreman-6r9y). */
  priority: InboxPriority;
}

/**
 * Workspace-wide trigger inbox: every automation's live inbox + recent messages
 * in ONE call (the web /inbox page's source), ranked by how much attention each
 * needs. Automations are a shared workspace resource, so this already spans every
 * member — but each trigger inbox lives under its OWNER's Zapier identity, so we
 * read each inbox with the owner's SDK (reading a teammate's inbox with the
 * requester's SDK 403s). One SDK is resolved per distinct owner and cached; an
 * un-connected owner or a per-inbox failure degrades to an empty entry rather
 * than failing the whole view. Entries come back sorted highest-priority first.
 */
export async function getWorkspaceInbox(
  userId: string,
): Promise<{ entries: WorkspaceInboxEntry[] }> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const automations = await store.listAutomations(workspaceId);
  const withInbox = automations.filter((a): a is AutomationRow & { trigger_inbox_id: string } =>
    Boolean(a.trigger_inbox_id),
  );
  if (withInbox.length === 0) return { entries: [] };

  // Resolve one experimental SDK per distinct owner (cached; null = can't read).
  const sdkByOwner = new Map<string, Promise<ExperimentalZapierSdk | null>>();
  const sdkFor = (ownerId: string): Promise<ExperimentalZapierSdk | null> => {
    let p = sdkByOwner.get(ownerId);
    if (!p) {
      p = getExperimentalSdkForUser(ownerId).catch(() => null);
      sdkByOwner.set(ownerId, p);
    }
    return p;
  };

  const entries = await Promise.all(
    withInbox.map(async (a): Promise<WorkspaceInboxEntry> => {
      const automation = {
        id: a.id,
        name: a.name,
        enabled: a.enabled,
        trigger: a.trigger,
        status: a.status,
      };
      const owner = { userId: a.user_id, isSelf: a.user_id === userId };

      let inbox: InboxView["inbox"] = null;
      let messages: InboxView["messages"] = [];
      const sdk = await sdkFor(a.user_id);
      if (sdk) {
        try {
          [inbox, messages] = await Promise.all([
            getInbox(sdk, a.trigger_inbox_id),
            listInboxMessages(sdk, a.trigger_inbox_id, 20),
          ]);
        } catch {
          inbox = null;
          messages = [];
        }
      }

      const priority = scoreInboxEntry({
        automationStatus: a.status,
        enabled: a.enabled,
        inboxStatus: inbox?.status ?? null,
        inboxPausedReason: inbox?.paused_reason ?? null,
        messages,
      });

      return { automation, owner, inbox, messages, priority };
    }),
  );

  // Rank: most-needs-attention first. Stable for equal scores (Array.sort keeps
  // the listAutomations updated_at order on ties).
  entries.sort((x, y) => y.priority.score - x.priority.score);
  return { entries };
}

export interface RunResult {
  runId: string;
  triggerId: string;
  status: string;
  durableRunId: string | null;
}

/** Manually fire an automation by its Foreman id; records the run. Returns null if not found. */
export async function runAutomationById(
  userId: string,
  automationId: string,
  runInput?: Record<string, unknown>,
): Promise<RunResult | null> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const automation = await store.getAutomation(workspaceId, automationId);
  if (!automation) return null;

  const sdk = await getExperimentalSdkForUser(userId);
  const { triggerId } = await triggerAutomation({
    sdk,
    workflowId: automation.zapier_workflow_id,
    input: runInput,
  });
  const run = await getTriggerRunStatus(sdk, triggerId);

  const runId = await store.recordRun({
    automationId,
    workspaceId: workspaceId ?? null,
    triggerId,
    durableRunId: run.durableRunId,
    status: run.status,
    input: runInput,
  });

  return { runId, triggerId, status: run.status, durableRunId: run.durableRunId };
}

const TERMINAL_RUN = new Set(["finished", "failed", "cancelled"]);

export interface CancelRunResult {
  cancelled: boolean;
  status: string;
}

/**
 * Cancel a running automation run (foreman-y4kc). Workspace-scoped: returns null if
 * the run isn't in the caller's workspace. Already-terminal runs are a no-op. A run
 * that hasn't linked its durable yet is cancelled locally (so reconcile stops
 * chasing it); otherwise cancelDurableRun stops it on Zapier and we record the
 * resulting status.
 */
export async function cancelRunForUser(
  userId: string,
  runId: string,
): Promise<CancelRunResult | null> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const run = await store.getRun(workspaceId, runId);
  if (!run) return null;
  if (TERMINAL_RUN.has(run.status)) return { cancelled: false, status: run.status };

  if (!run.durable_run_id) {
    await store.updateRun(run.id, { status: "cancelled" });
    return { cancelled: true, status: "cancelled" };
  }

  const sdk = await getExperimentalSdkForUser(userId);
  const status = await cancelDurableRun(sdk, run.durable_run_id);
  await store.updateRun(run.id, { status });
  return { cancelled: status === "cancelled", status };
}

export interface CallbackResponseInput {
  /** Payload to POST to the gate — resumes the durable (approve). */
  payload?: unknown;
  /** Cancel the whole run instead of resuming (hard deny). */
  cancel?: boolean;
  /** Which gate, when the durable has more than one open callback. */
  callbackName?: string;
}

export interface CallbackResponseResult {
  ok: boolean;
  action: "resumed" | "cancelled" | "none";
  /** HTTP status of the callback POST (resume only). */
  status?: number;
  /** Why it couldn't act, when ok=false. */
  reason?: string;
}

/**
 * Respond to a durable's human-approval gate (foreman-zfnj). Approve = POST the
 * payload to the callback URL (resolved server-side and never exposed to the
 * client); hard-deny = cancel the run. The run stays "waiting" in Foreman until
 * reconcile advances it (the durable leaves "waiting" once the callback lands).
 * Returns null if the run isn't in the caller's workspace.
 */
export async function respondToCallbackForUser(
  userId: string,
  runId: string,
  input: CallbackResponseInput,
): Promise<CallbackResponseResult | null> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const run = await store.getRun(workspaceId, runId);
  if (!run) return null;
  if (run.status !== "waiting" || !run.durable_run_id) {
    return { ok: false, action: "none", reason: "run is not waiting on a callback" };
  }

  const sdk = await getExperimentalSdkForUser(userId);

  if (input.cancel) {
    const status = await cancelDurableRun(sdk, run.durable_run_id);
    await store.updateRun(run.id, { status });
    return { ok: status === "cancelled", action: "cancelled" };
  }

  const cb = await resolveCallbackUrl(sdk, run.durable_run_id, input.callbackName);
  if (!cb) {
    return { ok: false, action: "none", reason: "no open callback URL for this run" };
  }
  const res = await postCallback(cb.url, input.payload ?? {});
  return { ok: res.ok, action: "resumed", status: res.status };
}

export interface UpdateInput {
  name?: string;
  description?: string | null;
  enabled?: boolean;
}

/** Rename / re-describe / enable-disable an automation, syncing the enabled flag to Zapier. */
export async function updateAutomationForUser(
  userId: string,
  automationId: string,
  patch: UpdateInput,
): Promise<boolean> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const automation = await store.getAutomation(workspaceId, automationId);
  if (!automation) return false;

  let status = automation.status;
  if (patch.enabled !== undefined && patch.enabled !== automation.enabled) {
    const sdk = await getExperimentalSdkForUser(userId);
    const enabled = await setAutomationEnabled(sdk, automation.zapier_workflow_id, patch.enabled);
    status = enabled ? "active" : "disabled";
  }

  return store.updateAutomation(workspaceId, automationId, {
    name: patch.name,
    description: patch.description,
    enabled: patch.enabled,
    status: patch.enabled !== undefined ? status : undefined,
  });
}

/** Delete the automation (workspace-scoped) and best-effort remove its Zapier workflow. */
export async function removeAutomationForUser(
  userId: string,
  automationId: string,
): Promise<boolean> {
  const workspaceId = (await resolveActiveWorkspace(userId)) ?? undefined;
  const removed = await store.deleteAutomation(workspaceId, automationId);
  if (!removed) return false;
  try {
    const sdk = await getExperimentalSdkForUser(userId);
    await deleteZapierWorkflow(sdk, removed.zapier_workflow_id);
  } catch {
    // The Foreman record is gone; Zapier cleanup is best-effort (the workflow can
    // be reaped separately). Don't fail the delete on a Zapier hiccup.
  }
  return true;
}
