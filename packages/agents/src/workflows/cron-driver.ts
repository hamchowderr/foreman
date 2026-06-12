/**
 * Cron driver — long-running worker that fires workflow_trigger rows of
 * type='cron' when their schedule matches the current minute.
 *
 * Resolution is one minute. We tick at the top of each wall-clock minute
 * (with a tiny offset so we land just after, never before). For each enabled
 * cron trigger we evaluate the 5-field expression against `now` in the
 * trigger's timezone (defaulting to UTC) and dispatch via executeWorkflow.
 *
 * `last_fired_at` is set to the minute boundary that fired, so a tick that
 * happens twice in the same minute (process restart, clock skew) won't
 * double-fire.
 *
 * The driver is intentionally simple — no missed-tick catch-up, no
 * distributed locking. If the process is down for a minute, that minute's
 * fires are skipped. If two drivers run, both could fire — only run one.
 */

import { getSupabase } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflows/engine";

/**
 * Match a 5-field cron expression against a Date interpreted in the given
 * IANA timezone. Supports: `*`, exact numbers, comma lists, ranges (`a-b`),
 * step values (`* /n`, `a-b/n`). Field order: minute, hour, dom, month, dow.
 *
 * Day-of-week: 0=Sunday..6=Saturday (Cron-classic). 7 also accepted as Sunday.
 *
 * When both DOM and DOW are restricted, fires when EITHER matches — that's
 * the standard cron behavior.
 */
export function cronMatches(expr: string, when: Date, timezone = "UTC"): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression (need 5 fields): ${expr}`);
  }
  const [minF, hourF, domF, monF, dowF] = parts;

  // Extract calendar fields in the target timezone.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts2 = Object.fromEntries(fmt.formatToParts(when).map((p) => [p.type, p.value]));
  const minute = Number(parts2.minute);
  const hour = Number(parts2.hour) % 24; // hour12:false sometimes returns 24
  const day = Number(parts2.day);
  const month = Number(parts2.month);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = weekdayMap[parts2.weekday as string];

  const minOk = matchField(minF, minute, 0, 59);
  const hourOk = matchField(hourF, hour, 0, 23);
  const monOk = matchField(monF, month, 1, 12);
  const domOk = matchField(domF, day, 1, 31);
  const dowOk = matchField(dowF, dow === 0 ? 0 : dow, 0, 7, (n) => (n === 7 ? 0 : n));

  // DOM/DOW: restricted-OR rule
  const bothRestricted = domF !== "*" && dowF !== "*";
  const dayOk = bothRestricted ? domOk || dowOk : domOk && dowOk;
  return minOk && hourOk && monOk && dayOk;
}

function matchField(
  field: string,
  value: number,
  min: number,
  max: number,
  normalize: (n: number) => number = (n) => n,
): boolean {
  for (const part of field.split(",")) {
    let range = part;
    let step = 1;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r;
      step = Number(s);
      if (!Number.isFinite(step) || step <= 0) return false;
    }
    let lo = min;
    let hi = max;
    if (range !== "*") {
      if (range.includes("-")) {
        const [a, b] = range.split("-").map(Number);
        lo = normalize(a);
        hi = normalize(b);
      } else {
        const n = normalize(Number(range));
        lo = n;
        hi = n;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
    if (value >= lo && value <= hi && (value - lo) % step === 0) return true;
  }
  return false;
}

interface CronTriggerRow {
  id: string;
  workflow_id: string;
  config: string;
  last_fired_at: string | null;
}

/**
 * Round a Date down to the current minute (zero seconds + ms). Used as the
 * fingerprint for `last_fired_at` so the same cron tick can't fire twice.
 */
function minuteFloor(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  return out;
}

/** Single-tick handler. Exported for testing. */
export async function tickCron(now: Date = new Date()): Promise<{ fired: number }> {
  const supabase = getSupabase();
  const tickMinute = minuteFloor(now);
  const tickIso = tickMinute.toISOString();

  const { data: rows, error } = await supabase
    .from("workflow_trigger")
    .select("id, workflow_id, config, last_fired_at")
    .eq("type", "cron")
    .eq("enabled", true);
  if (error) throw new Error(`cron-driver: ${error.message}`);

  let fired = 0;
  for (const row of (rows ?? []) as unknown as CronTriggerRow[]) {
    let cfg: { schedule: string; timezone?: string };
    try {
      cfg = JSON.parse(row.config);
    } catch {
      console.warn(`[cron-driver] trigger ${row.id} has invalid config — skipping`);
      continue;
    }
    if (!cfg.schedule) continue;

    let matches = false;
    try {
      matches = cronMatches(cfg.schedule, tickMinute, cfg.timezone ?? "UTC");
    } catch (e) {
      console.warn(`[cron-driver] trigger ${row.id} has invalid schedule '${cfg.schedule}':`, e);
      continue;
    }
    if (!matches) continue;

    // Find the workflow's owner so executeWorkflow can run with the right userId.
    const { data: wf } = await supabase
      .from("workflow")
      .select("user_id")
      .eq("id", row.workflow_id)
      .maybeSingle();
    if (!wf) {
      console.warn(`[cron-driver] trigger ${row.id} → workflow ${row.workflow_id} missing`);
      continue;
    }

    // Atomic same-minute claim: set last_fired_at=tickIso only if this trigger
    // hasn't already fired this minute. The conditional UPDATE is the lock —
    // two overlapping ticks (e.g. a process restart mid-minute, or briefly
    // co-existing drivers) can't both claim the same minute, so the workflow
    // fires exactly once even when last_fired_at hadn't yet been persisted.
    const { data: claimed, error: claimErr } = await supabase
      .from("workflow_trigger")
      .update({ last_fired_at: tickIso, updated_at: tickIso })
      .eq("id", row.id)
      .or(`last_fired_at.is.null,last_fired_at.lt.${tickIso}`)
      .select("id");
    if (claimErr) {
      console.warn(`[cron-driver] trigger ${row.id} claim failed: ${claimErr.message}`);
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // another tick already fired it

    // Fire and forget — we don't await full completion to keep the tick fast.
    void runOne(row.workflow_id, wf.user_id as string, row.id);
    fired++;
  }
  return { fired };
}

async function runOne(workflowId: string, userId: string, triggerId: string) {
  // last_fired_at was already set by the atomic claim in tickCron, so the run is
  // dedup'd before we get here. We just execute and surface errors.
  try {
    for await (const ev of executeWorkflow(workflowId, userId, {})) {
      if (ev.type === "error") {
        console.warn(`[cron-driver] ${triggerId} workflow error: ${ev.message}`);
      }
    }
  } catch (err) {
    console.error(`[cron-driver] trigger ${triggerId} failed:`, err);
  }
}

/**
 * Start the driver. Returns a stop function. The driver self-aligns to wall-
 * clock minute boundaries — the first tick lands at the next :00 + 500ms.
 */
export function startCronDriver(): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 500);
    if (next.getTime() <= now.getTime()) next.setMinutes(next.getMinutes() + 1);
    const wait = next.getTime() - now.getTime();
    timer = setTimeout(async () => {
      try {
        const { fired } = await tickCron(new Date());
        if (fired > 0) console.log(`[cron-driver] fired ${fired} trigger(s)`);
      } catch (err) {
        console.error("[cron-driver] tick failed:", err);
      }
      scheduleNext();
    }, wait);
  };

  scheduleNext();
  console.log("[cron-driver] started");
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log("[cron-driver] stopped");
  };
}
