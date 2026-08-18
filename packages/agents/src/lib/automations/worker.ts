import { getDurableRunStatus, getTriggerRunStatus, triggerAutomation } from "../durable";
import { ensureInbox, type LeasedMessage, watchInbox } from "../trigger-inbox";
import { type ExperimentalZapierSdk, getExperimentalSdkForUser } from "../zapier/sdk";
import type { AutomationRow } from "./store";
import * as store from "./store";
import { type InboxTriggerSpec, inboxKeyFor } from "./types";

/**
 * Trigger-inbox worker (foreman-l7xq M3, rebuilt on the SDK in foreman-em74).
 *
 * One `watchTriggerInbox` SSE subscription per active inbox-triggered automation.
 * The SDK owns leasing, acking, releasing, retrying and the safety drain; this
 * module owns only what is genuinely Foreman's: arming the inbox and keeping the
 * automation row in sync with it, dedup (a DB constraint via claimInboxMessage,
 * so at-least-once redelivery can't double-fire), firing the durable, and
 * recording the run.
 *
 * This replaced a hand-rolled 60s poll loop that did the SDK's job by hand.
 * Messages now arrive on an SSE notification instead of waiting up to a minute
 * for the next tick. Single instance only — no distributed lock (foreman-h4ua).
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

/**
 * Arm an automation's trigger inbox and keep the automation row in sync with it
 * (foreman-dwf8). Idempotent: `ensureTriggerInbox` is keyed on the inbox key, so
 * calling this on every (re)subscribe is safe.
 *
 * The status sync matters as much as the arming: an inbox that can't subscribe
 * (missing/expired connection, bad inputs) goes "initialization_failure", and
 * without reflecting that the automation looks enabled in the UI while silently
 * never firing.
 */
export async function armInbox(opts: {
  sdk: Sdk;
  automation: AutomationRow;
}): Promise<{ id: string; status: string } | null> {
  const { sdk, automation } = opts;
  const spec = inboxSpecOf(automation);
  if (!spec) return null; // not inbox-triggered

  const inbox = await ensureInbox({
    sdk,
    key: inboxKeyFor(automation.id),
    app: spec.app,
    action: spec.action,
    connection: spec.connection,
    inputs: spec.inputs,
  });

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

  return { id: inbox.id, status: inbox.status };
}

/**
 * Arm one automation's inbox and subscribe to it. Resolves when `signal` aborts.
 *
 * `dispatchMessage` returns rather than throws, so translate here: "processed"
 * and "skipped" both resolve (ack — either handled or a duplicate we never want
 * again), while "failed" throws so the SDK releases it for redelivery.
 */
export async function watchAutomationInbox(opts: {
  sdk: Sdk;
  automation: AutomationRow;
  signal: AbortSignal;
  leaseLimit?: number;
  leaseSeconds?: number;
}): Promise<void> {
  const { sdk, automation, signal, leaseLimit = 25, leaseSeconds = 60 } = opts;

  const inbox = await armInbox({ sdk, automation });
  if (!inbox) return;
  if (inbox.status === "initialization_failure") {
    // Nothing will ever arrive; armInbox already flagged the row. Don't hold a
    // subscription open against a dead inbox — the refresh pass retries it.
    return;
  }

  await watchInbox({
    sdk,
    inbox: inbox.id,
    leaseLimit,
    leaseSeconds,
    signal,
    onMessage: async (message) => {
      const outcome = await dispatchMessage({ sdk, automation, message });
      if (outcome === "failed") {
        throw new Error(`dispatch failed for message ${message.id}`);
      }
    },
    onError: (err, message) => {
      console.error(`[inbox-worker] ${automation.id} message ${message.id} released:`, err);
    },
  });
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

export interface InboxWatcherOptions {
  /** How often to reconcile live subscriptions against the active automation set. */
  refreshIntervalMs?: number;
  /** How often to advance fired-but-not-terminal runs to their real status. */
  reconcileIntervalMs?: number;
}

/**
 * Start one SSE subscription per active inbox-triggered automation and keep that
 * set current. Returns a stop handle. Run a single instance (foreman-h4ua).
 *
 * Two independent timers, because they answer different questions:
 *   - refresh    — which automations should be subscribed right now? Adds new
 *                  ones, aborts ones that were disabled or deleted, and
 *                  re-subscribes any whose stream ended.
 *   - reconcile  — what happened to runs we already fired? This follows the
 *                  durable, not the inbox, so it stays on a timer no matter how
 *                  messages arrive.
 *
 * Message delivery itself is NOT on a timer any more; that is the point of the
 * change. A subscription that ends for any reason (dropped stream, expired
 * connection, an inbox still initializing) removes itself from the map, so the
 * next refresh re-subscribes it — recovery without its own retry loop.
 */
export function startInboxWatcher(opts: InboxWatcherOptions = {}): () => void {
  const { refreshIntervalMs = 60_000, reconcileIntervalMs = 60_000 } = opts;
  const subscriptions = new Map<string, AbortController>();
  let stopped = false;

  const subscribe = async (automation: AutomationRow) => {
    const controller = new AbortController();
    subscriptions.set(automation.id, controller); // sync, before any await
    try {
      const sdk = await getExperimentalSdkForUser(automation.user_id);
      // Resolves only when the signal aborts.
      await watchAutomationInbox({ sdk, automation, signal: controller.signal });
    } catch (err) {
      // One automation's failure (e.g. an unconnected owner) must not stop the rest.
      if (!controller.signal.aborted) {
        console.error(`[inbox-worker] subscription for ${automation.id} ended:`, err);
      }
    } finally {
      // Only clear our own entry — a refresh may already have replaced it.
      if (subscriptions.get(automation.id) === controller) subscriptions.delete(automation.id);
    }
  };

  const refresh = async () => {
    if (stopped) return;
    const automations = await store.listActiveInboxAutomations();
    const active = new Map(automations.filter((a) => a.user_id).map((a) => [a.id, a]));

    for (const [id, controller] of subscriptions) {
      if (!active.has(id)) {
        controller.abort();
        subscriptions.delete(id);
      }
    }
    for (const [id, automation] of active) {
      if (!subscriptions.has(id)) void subscribe(automation);
    }
  };

  const reconcile = async () => {
    if (stopped) return;
    const rec = await reconcilePendingRuns();
    if (rec.updated) {
      console.log(`[inbox-worker] reconciled ${rec.updated}/${rec.checked} runs`);
    }
  };

  const safely = (fn: () => Promise<void>, label: string) => () => {
    fn().catch((err) => console.error(`[inbox-worker] ${label} failed:`, err));
  };

  const refreshTimer = setInterval(safely(refresh, "refresh"), refreshIntervalMs);
  const reconcileTimer = setInterval(safely(reconcile, "reconcile"), reconcileIntervalMs);
  safely(refresh, "refresh")();

  return () => {
    stopped = true;
    clearInterval(refreshTimer);
    clearInterval(reconcileTimer);
    // Aborting releases any unprocessed leased messages and resolves each watcher.
    for (const controller of subscriptions.values()) controller.abort();
    subscriptions.clear();
  };
}
