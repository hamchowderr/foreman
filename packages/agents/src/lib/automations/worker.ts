import { getDurableRunStatus, getTriggerRunStatus, triggerAutomation } from "../durable";
import {
  ackMessages,
  ensureInbox,
  type LeasedMessage,
  leaseMessages,
  releaseMessages,
} from "../trigger-inbox";
import { type ExperimentalZapierSdk, getExperimentalSdkForUser } from "../zapier/sdk";
import { buildDigest, type DigestInputRun } from "./digest";
import { narrateDigest } from "./digest-narrator";
import { isDigestTrigger, isScheduleDue, scheduleOf } from "./schedule";
import type { AutomationRow } from "./store";
import * as store from "./store";
import { type InboxTriggerSpec, inboxKeyFor } from "./types";

/** How far back a daily digest looks when synthesizing recent activity. */
const DIGEST_PERIOD_MS = 24 * 60 * 60 * 1000;

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
 * Opt-in event-level dedup (foreman-b8k2). Off by default: `possible_duplicate_data`
 * is Zapier's HEURISTIC that the underlying event may be a re-delivery under a NEW
 * message id (which our message-id claim can't catch), so skipping it risks dropping
 * a real event. Flip this on for a known-flaky trigger; regardless, the inbox view
 * always badges these messages so an operator can spot the pattern first.
 */
function skipPossibleDuplicates(): boolean {
  return process.env.FOREMAN_SKIP_POSSIBLE_DUPLICATES === "true";
}

/**
 * Claim (dedup) a single leased message and, if fresh, fire the durable and record
 * the run. Returns "skipped" when the message was already claimed (redelivery) or
 * dropped as a possible duplicate event (b8k2), "failed" when the trigger errored
 * (caller releases it for retry).
 */
export async function dispatchMessage(opts: {
  sdk: Sdk;
  automation: AutomationRow;
  message: LeasedMessage;
}): Promise<DispatchOutcome> {
  const { sdk, automation, message } = opts;

  // Drop possible-duplicate events before claiming so they're acked, not re-run
  // (foreman-b8k2). Only when explicitly enabled — see skipPossibleDuplicates().
  if (skipPossibleDuplicates() && message.message_attributes.possible_duplicate_data) {
    return "skipped";
  }

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
    key: inboxKeyFor(automation.id),
    app: spec.app,
    action: spec.action,
    connection: spec.connection,
    inputs: spec.inputs,
  });
  result.inboxId = inbox.id;
  result.inboxStatus = inbox.status;

  // Keep the automation row in sync with its inbox subscription (foreman-dwf8):
  // persist the inbox id the first time we arm it, AND reflect a failed/recovered
  // subscription in the automation status. An inbox that can't subscribe (missing/
  // expired connection, bad inputs) goes "initialization_failure" — without this the
  // automation looks enabled in the UI but silently never fires.
  const patch: Parameters<typeof store.updateAutomation>[2] = {};
  if (automation.trigger_inbox_id !== inbox.id) patch.triggerInboxId = inbox.id;
  if (inbox.status === "initialization_failure") {
    if (automation.status !== "trigger_failed") patch.status = "trigger_failed";
  } else if (automation.status === "trigger_failed") {
    patch.status = "active"; // subscription recovered — clear the failed flag
  }
  if (Object.keys(patch).length > 0) {
    await store.updateAutomation(automation.workspace_id ?? undefined, automation.id, patch);
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
 * Synthesize a daily digest for a digest automation (foreman-ufo3.2). Gathers the
 * workspace's recent runs (excluding the digest's own), builds a deterministic
 * prioritized summary, and records it as a `finished` run whose `output` is the
 * digest — so it lands in the inbox (getLatestDigest reads it via the `kind` tag)
 * with no new table. A workspace-less automation records an empty-period digest.
 */
async function runDigestForAutomation(automation: AutomationRow, now: number): Promise<void> {
  const periodEnd = new Date(now).toISOString();
  const periodStart = new Date(now - DIGEST_PERIOD_MS).toISOString();

  let input: DigestInputRun[] = [];
  if (automation.workspace_id) {
    const runs = await store.listRecentRunsForWorkspace(automation.workspace_id, periodStart, {
      excludeAutomationId: automation.id,
    });
    const names = new Map(
      (await store.getAutomationsByIds([...new Set(runs.map((r) => r.automation_id))])).map((a) => [
        a.id,
        a.name,
      ]),
    );
    input = runs.map((r) => ({
      automationId: r.automation_id,
      automationName: names.get(r.automation_id) ?? "(deleted automation)",
      status: r.status,
      error: r.error,
      createdAt: r.created_at,
    }));
  }

  const digest = buildDigest(input, periodStart, periodEnd);
  // Optional LLM prose summary (opt-in; null when disabled or on failure).
  digest.narrative = await narrateDigest(digest);
  await store.recordRun({
    automationId: automation.id,
    workspaceId: automation.workspace_id,
    status: "finished",
    output: digest,
    input: { scheduledAt: periodEnd },
  });
}

export interface ScheduleFireResult {
  automationId: string;
  fired: boolean;
  status?: string;
  /** Why it wasn't fired (an error) — omitted on a normal skip/fire. */
  reason?: string;
}

/**
 * Fire scheduled automations whose next run is due (foreman-ufo3.1). Runs every
 * worker tick alongside the inbox cycle. A due automation's durable is fired via
 * triggerAutomation and the run recorded as "started"; reconcilePendingRuns then
 * advances it exactly like an event-fired run. Digest automations (foreman-ufo3.2)
 * are recognized here but their synthesis is wired in that slice — for now they're
 * skipped so we never fire a bare durable for one.
 *
 * Due-ness is derived from the automation's last run time, so recording the run
 * makes the next tick see it as not-due — no separate cursor. The single-instance,
 * non-overlapping worker means no distributed lock is needed.
 */
export async function runDueSchedules(now: number = Date.now()): Promise<ScheduleFireResult[]> {
  const automations = await store.listActiveScheduledAutomations();
  const results: ScheduleFireResult[] = [];
  for (const automation of automations) {
    const schedule = scheduleOf(automation.trigger);
    if (!schedule) continue;
    try {
      const lastRunAt = await store.getLastRunAt(automation.id);
      const lastMs = lastRunAt ? new Date(lastRunAt).getTime() : null;
      if (!isScheduleDue(schedule, lastMs, now)) {
        results.push({ automationId: automation.id, fired: false });
        continue;
      }

      // A digest synthesizes recent runs instead of firing a durable (foreman-ufo3.2).
      if (isDigestTrigger(automation.trigger)) {
        await runDigestForAutomation(automation, now);
        results.push({ automationId: automation.id, fired: true, status: "finished" });
        continue;
      }

      const sdk = await getExperimentalSdkForUser(automation.user_id);
      const input = { scheduledAt: new Date(now).toISOString() };
      const { triggerId } = await triggerAutomation({
        sdk,
        workflowId: automation.zapier_workflow_id,
        input,
      });
      await store.recordRun({
        automationId: automation.id,
        workspaceId: automation.workspace_id,
        triggerId,
        status: "started",
        input,
      });
      results.push({ automationId: automation.id, fired: true, status: "started" });
    } catch (err) {
      // One schedule's failure (e.g. an unconnected owner) must not stop the others.
      console.error(`[inbox-worker] schedule ${automation.id} fire failed:`, err);
      results.push({
        automationId: automation.id,
        fired: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/**
 * How long a run may stay non-terminal WITHOUT a linked, running durable before we
 * give up and mark it failed. This caps the genuinely-stuck cases (trigger never
 * spawned a durable; worker crashed before dispatch; owner connection lost) — it
 * does NOT cap a run whose durable IS linked and still running, because durables
 * can legitimately run for days (waits / human-approval callbacks).
 */
const STUCK_RUN_TIMEOUT_MS = Number(process.env.FOREMAN_RUN_STUCK_TIMEOUT_MS) || 900_000; // 15 min

/**
 * Advance fired-but-not-terminal runs to their real terminal status, and fail
 * genuinely-stuck ones. The durable run is the authority: trigger_id →
 * (getTriggerRun) durable_run_id → (getDurableRun) started → finished/failed. The
 * trigger run's own status never advances, so we follow the chain. Safe every
 * cycle — only non-terminal rows are touched, only changes are written.
 */
export async function reconcilePendingRuns(): Promise<{ checked: number; updated: number }> {
  const pending = await store.listPendingRuns();
  if (pending.length === 0) return { checked: 0, updated: 0 };

  const automationIds = [...new Set(pending.map((r) => r.automation_id))];
  const automations = await store.getAutomationsByIds(automationIds);
  const byId = new Map(automations.map((a) => [a.id, a]));

  let updated = 0;
  const failRun = async (id: string, reason: string) => {
    await store.updateRun(id, { status: "failed", error: { message: reason } });
    updated++;
  };

  for (const run of pending) {
    const automation = byId.get(run.automation_id);
    if (!automation) continue;
    const tooOld = Date.now() - new Date(run.created_at).getTime() > STUCK_RUN_TIMEOUT_MS;

    // Claimed but never dispatched (worker crashed between claim and fire).
    if (!run.trigger_id) {
      if (tooOld) await failRun(run.id, "stuck: claimed but never dispatched");
      continue;
    }
    if (!automation.user_id) continue;

    try {
      const sdk = await getExperimentalSdkForUser(automation.user_id);

      // Resolve the durable run id (it lags the trigger by a few seconds).
      let durableRunId = run.durable_run_id;
      if (!durableRunId) {
        const tr = await getTriggerRunStatus(sdk, run.trigger_id);
        durableRunId = tr.durableRunId;
      }
      if (!durableRunId) {
        // Should link within seconds. If it never has, the trigger failed to spawn.
        if (tooOld) await failRun(run.id, "stuck: durable run never linked");
        continue;
      }

      const dr = await getDurableRunStatus(sdk, durableRunId);
      // "cancelled" is terminal too (foreman-y4kc) — otherwise reconcile would flip a
      // just-cancelled durable back to "started".
      const terminal =
        dr.status === "finished" || dr.status === "failed" || dr.status === "cancelled";

      // Resolve the run's next status + the payload we surface as `error`:
      //   terminal  → finished/failed/cancelled, with the durable's own output/error
      //   waiting   → paused on a human-approval callback (foreman-rm8z); surface the
      //               callback gate(s) so the UI shows "waiting for approval"
      //   retrying  → a step is mid-retry (foreman-jc12): top-level status is still
      //               "started" but execution.detail carries last_error + the ops;
      //               surface that so the run doesn't look like a stalled "started"
      //   started   → executing cleanly; clear any stale detail
      let status: string;
      let nextError: unknown;
      if (terminal) {
        status = dr.status;
        nextError = dr.error ?? null;
      } else if (dr.detail?.waiting) {
        status = "waiting";
        nextError = dr.detail;
      } else if (dr.detail) {
        status = "retrying";
        nextError = dr.detail;
      } else {
        status = "started";
        nextError = null;
      }

      // A linked-but-still-running durable is left alone — NO age cap (durables can
      // run for days via waits/callbacks). Write on any real change, including the
      // retry detail evolving (retry_count / next_retry_at) while status stays
      // "retrying". Both are plain JSON so a stringify compare is enough.
      const errorChanged = JSON.stringify(nextError ?? null) !== JSON.stringify(run.error ?? null);
      if (status !== run.status || durableRunId !== run.durable_run_id || errorChanged) {
        await store.updateRun(run.id, {
          status,
          durableRunId,
          error: nextError,
          ...(terminal ? { output: dr.output } : {}),
        });
        if (terminal) updated++;
      }
    } catch (err) {
      // Owner disconnected / transient SDK error — give up only after the timeout.
      if (tooOld) {
        await failRun(
          run.id,
          `stuck: reconcile gave up — ${err instanceof Error ? err.message : String(err)}`,
        );
      } else {
        console.error(`[inbox-worker] reconcile run ${run.id} failed (will retry):`, err);
      }
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
      const scheduled = await runDueSchedules();
      const rec = await reconcilePendingRuns();
      const firedCount = scheduled.filter((s) => s.fired).length;
      if (results.length || firedCount || rec.updated) {
        const t = results.reduce(
          (a, r) => ({ p: a.p + r.processed, s: a.s + r.skipped, f: a.f + r.failed }),
          { p: 0, s: 0, f: 0 },
        );
        console.log(
          `[inbox-worker] ${results.length} automations · processed ${t.p} · skipped ${t.s} · failed ${t.f} · scheduled-fired ${firedCount} · reconciled ${rec.updated}/${rec.checked}`,
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
