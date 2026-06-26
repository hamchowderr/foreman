import { getTriggerRunStatus, triggerAutomation } from "@/lib/durable";
import {
  ackMessages,
  ensureInbox,
  type LeasedMessage,
  leaseMessages,
  releaseMessages,
} from "@/lib/trigger-inbox";
import { type ExperimentalZapierSdk, getExperimentalSdkForUser } from "@/lib/zapier/sdk";
import type { AutomationRow } from "./store";
import * as store from "./store";
import { type InboxTriggerSpec, inboxNameFor } from "./types";

/**
 * Trigger-inbox poll worker (foreman-l7xq M3). Replaces the removed
 * cron-driver-server. Each cycle, for every active inbox-triggered automation:
 * ensure its inbox (idempotent), lease a batch, dedup + dispatch each message to
 * the durable via triggerWorkflow, record the run, then ack (done) / release
 * (retry). Dedup is a DB constraint (claimInboxMessage) so an at-least-once
 * redelivery can't double-fire. Single instance only — no distributed lock.
 */

type Sdk = ExperimentalZapierSdk;

function inboxSpecOf(automation: AutomationRow): InboxTriggerSpec | null {
  const t = automation.trigger as Partial<InboxTriggerSpec> | null;
  if (!t || typeof t.app !== "string" || typeof t.action !== "string") return null;
  return { app: t.app, action: t.action, connection: t.connection ?? null, inputs: t.inputs };
}

export type DispatchOutcome = "processed" | "skipped" | "failed";

/**
 * Claim (dedup) a single leased message and, if fresh, fire the durable and record
 * the run. Returns "skipped" when the message was already claimed (redelivery),
 * "failed" when the trigger errored (caller releases it for retry).
 */
export async function dispatchMessage(opts: {
  sdk: Sdk;
  automation: AutomationRow;
  message: LeasedMessage;
}): Promise<DispatchOutcome> {
  const { sdk, automation, message } = opts;

  const runId = await store.claimInboxMessage({
    automationId: automation.id,
    workspaceId: automation.workspace_id,
    inboxMessageId: message.id,
  });
  if (!runId) return "skipped"; // already claimed — at-least-once redelivery

  try {
    const { triggerId } = await triggerAutomation({
      sdk,
      workflowId: automation.zapier_workflow_id,
      input: message.payload,
    });
    const run = await getTriggerRunStatus(sdk, triggerId);
    await store.updateRun(runId, {
      status: run.status,
      triggerId,
      durableRunId: run.durableRunId,
      output: run.output,
      error: run.error,
    });
    return "processed";
  } catch (err) {
    await store.updateRun(runId, {
      status: "failed",
      error: { message: err instanceof Error ? err.message : String(err) },
    });
    return "failed";
  }
}

export interface AutomationCycleResult {
  automationId: string;
  inboxId: string | null;
  inboxStatus: string | null;
  processed: number;
  skipped: number;
  failed: number;
}

export async function runInboxCycleForAutomation(opts: {
  sdk: Sdk;
  automation: AutomationRow;
  leaseLimit?: number;
  leaseSeconds?: number;
}): Promise<AutomationCycleResult> {
  const { sdk, automation, leaseLimit = 25, leaseSeconds = 60 } = opts;
  const result: AutomationCycleResult = {
    automationId: automation.id,
    inboxId: null,
    inboxStatus: null,
    processed: 0,
    skipped: 0,
    failed: 0,
  };

  const spec = inboxSpecOf(automation);
  if (!spec) return result; // not inbox-triggered

  const inbox = await ensureInbox({
    sdk,
    name: inboxNameFor(automation.id),
    app: spec.app,
    action: spec.action,
    connection: spec.connection,
    inputs: spec.inputs,
  });
  result.inboxId = inbox.id;
  result.inboxStatus = inbox.status;

  // Persist the inbox id the first time we arm it (so the UI can show it).
  if (automation.trigger_inbox_id !== inbox.id) {
    await store.updateAutomation(automation.workspace_id ?? undefined, automation.id, {
      triggerInboxId: inbox.id,
    });
  }

  const lease = await leaseMessages({ sdk, inbox: inbox.id, leaseLimit, leaseSeconds });
  if (!lease.lease_id || lease.results.length === 0) return result;

  const processed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  for (const message of lease.results) {
    const outcome = await dispatchMessage({ sdk, automation, message });
    if (outcome === "processed") processed.push(message.id);
    else if (outcome === "skipped") skipped.push(message.id);
    else failed.push(message.id);
  }

  // Ack what we handled or intentionally skipped; release failures to retry.
  const done = [...processed, ...skipped];
  if (done.length) {
    await ackMessages({ sdk, inbox: inbox.id, lease: lease.lease_id, messages: done });
  }
  if (failed.length) {
    await releaseMessages({ sdk, inbox: inbox.id, lease: lease.lease_id, messages: failed });
  }

  result.processed = processed.length;
  result.skipped = skipped.length;
  result.failed = failed.length;
  return result;
}

/** One full cycle across all active inbox-triggered automations (cross-workspace). */
export async function runInboxCycle(): Promise<AutomationCycleResult[]> {
  const automations = await store.listActiveInboxAutomations();
  const results: AutomationCycleResult[] = [];
  for (const automation of automations) {
    try {
      const sdk = await getExperimentalSdkForUser(automation.user_id);
      results.push(await runInboxCycleForAutomation({ sdk, automation }));
    } catch (err) {
      // One automation's failure (e.g. an unconnected owner) must not stop the cycle.
      console.error(`[inbox-worker] automation ${automation.id} cycle failed:`, err);
      results.push({
        automationId: automation.id,
        inboxId: automation.trigger_inbox_id,
        inboxStatus: "error",
        processed: 0,
        skipped: 0,
        failed: 0,
      });
    }
  }
  return results;
}

/** Start the worker on an interval. Returns a stop handle. Run a single instance. */
export function startInboxWorker(intervalMs = 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap cycles
    running = true;
    try {
      const results = await runInboxCycle();
      if (results.length) {
        const t = results.reduce(
          (a, r) => ({ p: a.p + r.processed, s: a.s + r.skipped, f: a.f + r.failed }),
          { p: 0, s: 0, f: 0 },
        );
        console.log(
          `[inbox-worker] ${results.length} automations · processed ${t.p} · skipped ${t.s} · failed ${t.f}`,
        );
      }
    } catch (err) {
      console.error("[inbox-worker] cycle error:", err);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(tick, intervalMs);
  void tick(); // run once immediately
  return () => clearInterval(handle);
}
