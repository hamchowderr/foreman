/**
 * ZapierPollSignalProvider — a Mastra SignalProvider that watches Zapier read
 * actions and fires saved workflows when new records appear.
 *
 * This lives ON the foreman agent (`signals: [zapierPollProvider]`), so it's a
 * first-class Mastra primitive — not a worker bolted onto the side. Hosting it
 * on the agent gives us `notify()`: when a poll turns up new data we drop a
 * notification signal (with the framework's native `dedupeKey`) into the user's
 * thread, so they *see* "new record → ran your workflow."
 *
 * Why we DON'T set `pollInterval`: the foreman agent is constructed in every
 * Foreman process (the :4111 server AND the :4112 webhook server build it via
 * the channel bots). If the provider auto-polled, it would fire in each process
 * — the same double-fire the cron driver avoids by running a single dedicated
 * instance. Instead we leave `pollInterval` undefined (no framework auto-poll)
 * and drive `runDuePolls()` from the single `cron-driver-server` process. One
 * Mastra app, the provider lives in the agent, one process ticks it.
 *
 * Firing stays deterministic: `runDuePolls()` runs the Zapier read via
 * `runAction`, diffs results against the persisted `last_dedupe_key` cursor, and
 * fires `executeWorkflow` once per new record — no LLM in the hot path. The
 * `notify()` call is best-effort and additive (skipped if no agent is connected
 * or the notification store is unavailable), so a notification hiccup never
 * blocks a workflow run.
 *
 * Config (workflow_trigger.config for type='poll'):
 *   { app, action, connection?, inputs?, dedupeKey, intervalMinutes? }
 * Reads are assumed newest-first (the Zapier "new X" convention). First poll
 * establishes a baseline (sets the cursor, fires nothing) so binding a trigger
 * doesn't replay the whole backlog.
 */

import { SignalProvider } from "@mastra/core/signals";
import { saveSnapshot } from "@/lib/dashboards/snapshot";
import { getSupabase } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflows/engine";
import { runAction } from "@/lib/zapier/execution";

/** Cap on how many backlog records a single poll will fire, to avoid a flood if
 * the cursor falls off the end of the returned page. */
const MAX_FIRE_PER_POLL = 25;

interface PollConfig {
  app: string;
  action: string;
  connection?: string;
  inputs?: Record<string, unknown>;
  /** Field on each record that uniquely identifies it (e.g. "id"). */
  dedupeKey: string;
  /** How often to poll, in minutes. Defaults to 5. */
  intervalMinutes?: number;
  /** When true, persist the FULL record set as an append-only app_data_snapshot
   * each cycle (powers dashboards), independent of per-record workflow firing. */
  snapshot?: boolean;
}

interface PollTriggerRow {
  id: string;
  workflow_id: string;
  config: string;
  last_fired_at: string | null;
  last_dedupe_key: string | null;
}

/** Normalize a Zapier read result into an array of record objects. Handles the
 * common shapes: a bare array, `{ data: [...] }`, or `{ results: [...] }`. */
function extractRecords(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
  }
  return [];
}

/** Stable string key for a record, read from the configured dedupeKey field. */
function recordKey(rec: Record<string, unknown>, dedupeKey: string): string | null {
  const v = rec[dedupeKey];
  if (v === undefined || v === null) return null;
  return String(v);
}

/**
 * Records strictly newer than the cursor, newest-first. Walks the page from the
 * top until it hits the cursor key; if the cursor isn't on the page (it scrolled
 * off, or this is a fresh page), every record counts as new (capped).
 */
function collectNewRecords(
  records: Record<string, unknown>[],
  dedupeKey: string,
  cursorKey: string | null,
): Record<string, unknown>[] {
  const fresh: Record<string, unknown>[] = [];
  for (const rec of records) {
    if (recordKey(rec, dedupeKey) === cursorKey) break;
    fresh.push(rec);
    if (fresh.length >= MAX_FIRE_PER_POLL) break;
  }
  return fresh;
}

/** Flatten a record's primitive fields to string inputs for {{param}}
 * substitution, plus the full record as JSON under `record`. */
function recordToInputs(rec: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    out[k] = String(v);
  }
  out.record = JSON.stringify(rec);
  return out;
}

export class ZapierPollSignalProvider extends SignalProvider<"zapier-poll"> {
  readonly id = "zapier-poll" as const;
  readonly name = "Zapier Poll Signals";
  // No `pollInterval` — see the file header. Driven by cron-driver-server.

  /**
   * Drop a notification signal into the workflow owner's thread. Best-effort:
   * the workflow fire is the primary action, so a missing agent connection or
   * notification-store error must never block it.
   */
  private async notifyOwner(
    triggerId: string,
    cfg: PollConfig,
    userId: string,
    rec: Record<string, unknown>,
    key: string | null,
  ): Promise<void> {
    if (!this.agent) return; // not connected (e.g. unit test, or non-worker process)
    try {
      await this.notify(
        {
          source: "zapier-poll",
          kind: `${cfg.app}.${cfg.action}`,
          summary: `New ${cfg.app} ${cfg.action}${key ? ` (${key})` : ""}`,
          payload: rec,
          // Native dedup — the same record key won't create a duplicate
          // notification even if a re-poll surfaces it again.
          dedupeKey: key ?? undefined,
        },
        { threadId: `poll:${triggerId}`, resourceId: userId },
      );
    } catch (err) {
      console.warn(`[zapier-poll] notify failed for trigger ${triggerId}:`, err);
    }
  }

  /**
   * Process one poll trigger: run its read action, diff against the cursor, fire
   * the workflow for each new record, notify the owner's thread, and advance the
   * cursor. Returns the number of workflow runs fired.
   */
  private async pollOne(
    row: PollTriggerRow,
    cfg: PollConfig,
    userId: string,
    nowIso: string,
  ): Promise<number> {
    const supabase = getSupabase();

    const result = await runAction(
      userId,
      cfg.app,
      "read",
      cfg.action,
      cfg.inputs ?? {},
      cfg.connection,
    );

    // A guardrail may demand confirmation — we can't fire autonomously then.
    if (result && typeof result === "object" && "__guardrail_confirmation_required" in result) {
      console.warn(`[zapier-poll] ${row.id} read needs confirmation — skipping this cycle`);
      return 0;
    }

    const records = extractRecords(result);

    // Dashboards: persist the full current record set as an append-only snapshot
    // every cycle (history for trend charts), independent of the dedup/fire path
    // below. Additive + best-effort — a snapshot failure must never block firing.
    if (cfg.snapshot) {
      try {
        await saveSnapshot({
          userId,
          appKey: cfg.app,
          sourceConfig: {
            app: cfg.app,
            action: cfg.action,
            connection: cfg.connection,
            inputs: cfg.inputs,
          },
          records,
          triggerId: row.id,
        });
      } catch (err) {
        console.error(`[zapier-poll] ${row.id} snapshot save failed:`, err);
      }
    }

    const cursorKey = row.last_dedupe_key ?? null;
    const newestKey = records.length ? recordKey(records[0], cfg.dedupeKey) : cursorKey;

    // Advance the cursor + mark polled even when nothing is new, so the interval
    // gate and baseline both work off last_fired_at / last_dedupe_key.
    await supabase
      .from("workflow_trigger")
      .update({ last_dedupe_key: newestKey, last_fired_at: nowIso, updated_at: nowIso })
      .eq("id", row.id);

    // First poll: establish the baseline, don't replay the backlog.
    if (cursorKey === null) return 0;

    const fresh = collectNewRecords(records, cfg.dedupeKey, cursorKey);
    if (fresh.length === 0) return 0;

    let fired = 0;
    // Fire oldest-first so the workflow sees records in chronological order.
    for (const rec of fresh.reverse()) {
      const key = recordKey(rec, cfg.dedupeKey);
      try {
        for await (const ev of executeWorkflow(
          row.workflow_id,
          userId,
          recordToInputs(rec),
          undefined,
          {
            firedBy: "poll",
            triggerId: row.id,
          },
        )) {
          if (ev.type === "error") {
            console.warn(`[zapier-poll] ${row.id} workflow error: ${ev.message}`);
          } else if (ev.type === "param_request") {
            console.warn(
              `[zapier-poll] ${row.id} workflow needs params not in the record: ${ev.missing?.join(", ")}`,
            );
          }
        }
        fired++;
        // Additive: surface the fire in the owner's thread via the signal.
        await this.notifyOwner(row.id, cfg, userId, rec, key);
      } catch (err) {
        console.error(`[zapier-poll] ${row.id} fire failed:`, err);
      }
    }
    return fired;
  }

  /**
   * Run every due poll trigger once. Called by cron-driver-server on its tick.
   * Exported behavior mirrors the cron driver's `tickCron`.
   */
  async runDuePolls(now: Date = new Date()): Promise<{ fired: number; polled: number }> {
    const supabase = getSupabase();
    const nowIso = now.toISOString();

    const { data: rows, error } = await supabase
      .from("workflow_trigger")
      .select("id, workflow_id, config, last_fired_at, last_dedupe_key")
      .eq("type", "poll")
      .eq("enabled", true);
    if (error) throw new Error(`zapier-poll: ${error.message}`);

    let fired = 0;
    let polled = 0;
    for (const row of (rows ?? []) as unknown as PollTriggerRow[]) {
      let cfg: PollConfig;
      try {
        cfg = JSON.parse(row.config);
      } catch {
        console.warn(`[zapier-poll] trigger ${row.id} has invalid config — skipping`);
        continue;
      }
      if (!cfg.app || !cfg.action || !cfg.dedupeKey) {
        console.warn(`[zapier-poll] trigger ${row.id} missing app/action/dedupeKey — skipping`);
        continue;
      }

      // Interval gate — only hit the Zapier action once per intervalMinutes.
      const intervalMs = Math.max(1, cfg.intervalMinutes ?? 5) * 60_000;
      if (row.last_fired_at) {
        const elapsed = now.getTime() - new Date(row.last_fired_at).getTime();
        if (elapsed < intervalMs) continue;
      }

      // Resolve the workflow owner so runAction/executeWorkflow run as that user.
      const { data: wf } = await supabase
        .from("workflow")
        .select("user_id")
        .eq("id", row.workflow_id)
        .maybeSingle();
      if (!wf) {
        console.warn(`[zapier-poll] trigger ${row.id} → workflow ${row.workflow_id} missing`);
        continue;
      }

      polled++;
      try {
        fired += await this.pollOne(row, cfg, wf.user_id as string, nowIso);
      } catch (err) {
        console.error(`[zapier-poll] trigger ${row.id} failed:`, err);
      }
    }
    return { fired, polled };
  }
}

/** Singleton hosted on the foreman agent (`signals: [...]`) and driven by the
 * cron-driver-server worker. */
export const zapierPollProvider = new ZapierPollSignalProvider();
