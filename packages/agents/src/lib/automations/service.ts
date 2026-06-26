import {
  deleteAutomation as deleteZapierWorkflow,
  deployAutomation,
  getTriggerRunStatus,
  setAutomationEnabled,
  triggerAutomation,
} from "@/lib/durable";
import type { DeployResult } from "@/lib/durable/deploy";
import { resolveActiveWorkspace } from "@/lib/identity";
import { getInbox, listInboxMessages } from "@/lib/trigger-inbox";
import { getExperimentalSdkForUser } from "@/lib/zapier/sdk";
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
