/**
 * Poll driver — long-running worker that fires `workflow_trigger` rows of
 * type='poll' when a Zapier read action returns records newer than the last
 * one we've seen.
 *
 * Model (matches the migration comment on workflow_trigger):
 *   config = { app, action, connection?, inputs?, dedupeKey, intervalMinutes? }
 *   - `dedupeKey` is the field on each returned record that uniquely identifies
 *     it (e.g. "id"). Reads are assumed newest-first (the Zapier convention for
 *     "new X" triggers).
 *   - `last_dedupe_key` is the persisted cursor: the key of the newest record
 *     we've already processed. New records = those above the cursor.
 *   - `last_fired_at` doubles as the last-polled timestamp; `intervalMinutes`
 *     gates how often we actually hit the Zapier action.
 *
 * First poll establishes the baseline (cursor was null → set it, fire nothing)
 * so binding a trigger doesn't replay the whole backlog. Subsequent polls fire
 * the saved workflow once per new record, oldest-first.
 *
 * Like the cron driver, this is intentionally simple — no distributed lock, no
 * missed-tick catch-up. Run a single instance (it lives in cron-driver-server
 * alongside the cron driver). Unlike cron we AWAIT each trigger's processing:
 * poll reads aren't minute-precision-sensitive, awaiting gives an accurate
 * fired count, and there are few poll triggers.
 *
 * Why a hand-rolled worker and not a Mastra SignalProvider: the alpha
 * SignalProvider poll loop skips entirely when its in-memory subscription
 * registry is empty, and `notify()` throws unless the provider is registered on
 * an in-process Agent — it's built for a provider that lives inside the agent
 * and notifies threads, not a singleton worker that fires DB-backed workflows.
 * The SignalProvider primitive is adopted on the webhook/channel path instead.
 * This worker keeps the door open to swap in Zapier's `watchTriggerInbox` SSE
 * later (foreman-iyq6) without touching the trigger storage or tools.
 */

import { getSupabase } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflows/engine";
import { runAction } from "@/lib/zapier/execution";

/** Cap on how many backlog records a single poll will fire, to avoid a flood
 * if the cursor falls off the end of the returned page. */
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
 * Records strictly newer than the cursor, newest-first. Walks the page from
 * the top until it hits the cursor key; if the cursor isn't on the page (it
 * scrolled off, or this is a fresh page), every record counts as new (capped).
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

/**
 * Process one poll trigger: run its read action, diff against the cursor, fire
 * the workflow for each new record, and advance the cursor. Returns the number
 * of workflow runs fired.
 */
async function pollOne(
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
    console.warn(`[poll-driver] ${row.id} read needs confirmation — skipping this cycle`);
    return 0;
  }

  const records = extractRecords(result);
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
    try {
      for await (const ev of executeWorkflow(row.workflow_id, userId, recordToInputs(rec))) {
        if (ev.type === "error") {
          console.warn(`[poll-driver] ${row.id} workflow error: ${ev.message}`);
        } else if (ev.type === "param_request") {
          console.warn(
            `[poll-driver] ${row.id} workflow needs params not in the record: ${ev.missing?.join(", ")}`,
          );
        }
      }
      fired++;
    } catch (err) {
      console.error(`[poll-driver] ${row.id} fire failed:`, err);
    }
  }
  return fired;
}

/** Single-tick handler. Exported for testing. */
export async function tickPoll(now: Date = new Date()): Promise<{ fired: number; polled: number }> {
  const supabase = getSupabase();
  const nowIso = now.toISOString();

  const { data: rows, error } = await supabase
    .from("workflow_trigger")
    .select("id, workflow_id, config, last_fired_at, last_dedupe_key")
    .eq("type", "poll")
    .eq("enabled", true);
  if (error) throw new Error(`poll-driver: ${error.message}`);

  let fired = 0;
  let polled = 0;
  for (const row of (rows ?? []) as unknown as PollTriggerRow[]) {
    let cfg: PollConfig;
    try {
      cfg = JSON.parse(row.config);
    } catch {
      console.warn(`[poll-driver] trigger ${row.id} has invalid config — skipping`);
      continue;
    }
    if (!cfg.app || !cfg.action || !cfg.dedupeKey) {
      console.warn(`[poll-driver] trigger ${row.id} missing app/action/dedupeKey — skipping`);
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
      console.warn(`[poll-driver] trigger ${row.id} → workflow ${row.workflow_id} missing`);
      continue;
    }

    polled++;
    try {
      fired += await pollOne(row, cfg, wf.user_id as string, nowIso);
    } catch (err) {
      console.error(`[poll-driver] trigger ${row.id} failed:`, err);
    }
  }
  return { fired, polled };
}

/**
 * Start the driver. Returns a stop function. Self-aligns to wall-clock minute
 * boundaries (first tick at the next :00 + 750ms — a hair after the cron driver
 * so the two don't contend on the same trigger table read).
 */
export function startPollDriver(): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 750);
    if (next.getTime() <= now.getTime()) next.setMinutes(next.getMinutes() + 1);
    const wait = next.getTime() - now.getTime();
    timer = setTimeout(async () => {
      if (!running) {
        running = true;
        try {
          const { fired, polled } = await tickPoll(new Date());
          if (fired > 0)
            console.log(`[poll-driver] fired ${fired} run(s) across ${polled} trigger(s)`);
        } catch (err) {
          console.error("[poll-driver] tick failed:", err);
        } finally {
          running = false;
        }
      }
      scheduleNext();
    }, wait);
  };

  scheduleNext();
  console.log("[poll-driver] started");
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log("[poll-driver] stopped");
  };
}
