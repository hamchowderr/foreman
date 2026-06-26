import { getDurableRunStatus, getTriggerRunStatus, triggerAutomation } from "@/lib/durable";
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
    // Fire-and-record. Do NOT poll for terminal status here: the durable may run
    // for seconds to days (waits/callbacks), and the trigger run's own status is
    // pinned at "started" anyway. reconcilePendingRuns() resolves the real
    // durable_run_id + finished/failed on a later pass.
    await store.updateRun(runId, { status: "started", triggerId });
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

/**
 * Advance fired-but-not-terminal runs to their real terminal status. The durable
 * run is the authority: trigger_id → (getTriggerRun) durable_run_id →
 * (getDurableRun) started → finished/failed. The trigger run's own status never
 * advances, so we must follow the chain. Safe to call every cycle — only
 * non-terminal rows are touched, and only changed ones are written.
 */
export async function reconcilePendingRuns(): Promise<{ checked: number; updated: number }> {
  const pending = await store.listPendingRuns();
  if (pending.length === 0) return { checked: 0, updated: 0 };

  const automationIds = [...new Set(pending.map((r) => r.automation_id))];
  const automations = await store.getAutomationsByIds(automationIds);
  const byId = new Map(automations.map((a) => [a.id, a]));

  let updated = 0;
  for (const run of pending) {
    const automation = byId.get(run.automation_id);
    if (!automation?.user_id || !run.trigger_id) continue;
    try {
      const sdk = await getExperimentalSdkForUser(automation.user_id);

      // Resolve the durable run id (it lags the trigger by a few seconds).
      let durableRunId = run.durable_run_id;
      if (!durableRunId) {
        const tr = await getTriggerRunStatus(sdk, run.trigger_id);
        durableRunId = tr.durableRunId;
      }
      if (!durableRunId) continue; // durable not linked yet — try again next cycle

      const dr = await getDurableRunStatus(sdk, durableRunId);
      const terminal = dr.status === "finished" || dr.status === "failed";
      const status = terminal ? dr.status : "started";

      if (status !== run.status || durableRunId !== run.durable_run_id) {
        await store.updateRun(run.id, {
          status,
          durableRunId,
          ...(terminal ? { output: dr.output, error: dr.error } : {}),
        });
        if (terminal) updated++;
      }
    } catch (err) {
      console.error(`[inbox-worker] reconcile run ${run.id} failed:`, err);
    }
  }
  return { checked: pending.length, updated };
}

/** Start the worker on an interval. Returns a stop handle. Run a single instance. */
export function startInboxWorker(intervalMs = 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap cycles
    running = true;
    try {
      const results = await runInboxCycle();
      const rec = await reconcilePendingRuns();
      if (results.length || rec.updated) {
        const t = results.reduce(
          (a, r) => ({ p: a.p + r.processed, s: a.s + r.skipped, f: a.f + r.failed }),
          { p: 0, s: 0, f: 0 },
        );
        console.log(
          `[inbox-worker] ${results.length} automations · processed ${t.p} · skipped ${t.s} · failed ${t.f} · reconciled ${rec.updated}/${rec.checked}`,
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
