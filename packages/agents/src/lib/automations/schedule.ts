/**
 * Automation scheduling (foreman-ufo3.1). A Foreman-side cron layer that runs
 * inside the inbox worker — the job the removed cron-driver-server used to do,
 * minus a second process. A scheduled automation carries its schedule in the
 * SAME `trigger` json as event automations, under a `schedule` key, so it's
 * naturally excluded from the event path (which requires `app`+`action`).
 *
 * Dependency-free by design: `interval` + `daily` cover the daily-digest
 * acceptance and need no cron parser. Full cron-expression support is a
 * follow-up (foreman-ufo3.3) that can slot a parser behind `scheduleOf`.
 *
 * Pure + clock-injected (`nowMs`) so the due-check is deterministic in tests.
 */

export type ScheduleSpec =
  | { kind: "interval"; everyMinutes: number }
  | { kind: "daily"; atHourUtc: number; atMinuteUtc?: number };

/** The scheduled shape of `automation.trigger` (alongside the event shape). */
export interface ScheduleTriggerSpec {
  schedule: ScheduleSpec;
  /** Marks a digest automation — synthesizes recent runs instead of firing a durable (foreman-ufo3.2). */
  digest?: boolean;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function isInt(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Extract + validate a schedule from an automation's `trigger` json. Returns null
 * when the trigger isn't a (well-formed) schedule — an event trigger, a malformed
 * schedule, or nothing — so callers can treat "no schedule" and "bad schedule"
 * alike (the worker just won't fire it).
 */
export function scheduleOf(trigger: unknown): ScheduleSpec | null {
  if (!trigger || typeof trigger !== "object") return null;
  const s = (trigger as { schedule?: unknown }).schedule;
  if (!s || typeof s !== "object") return null;
  const spec = s as Record<string, unknown>;

  if (spec.kind === "interval") {
    // At least 1 minute; guard against a runaway sub-minute schedule.
    return isInt(spec.everyMinutes, 1, 60 * 24 * 366)
      ? { kind: "interval", everyMinutes: spec.everyMinutes }
      : null;
  }
  if (spec.kind === "daily") {
    if (!isInt(spec.atHourUtc, 0, 23)) return null;
    const atMinuteUtc = spec.atMinuteUtc === undefined ? 0 : spec.atMinuteUtc;
    if (!isInt(atMinuteUtc, 0, 59)) return null;
    return { kind: "daily", atHourUtc: spec.atHourUtc, atMinuteUtc };
  }
  return null;
}

/** True when `trigger` carries a digest schedule (foreman-ufo3.2 routing). */
export function isDigestTrigger(trigger: unknown): boolean {
  return scheduleOf(trigger) !== null && (trigger as { digest?: unknown }).digest === true;
}

/**
 * The most recent scheduled boundary at or before `nowMs` for a daily schedule:
 * today's atHour:atMinute (UTC) if that's already passed, else yesterday's.
 */
function lastDailyBoundary(atHourUtc: number, atMinuteUtc: number, nowMs: number): number {
  const now = new Date(nowMs);
  const todayBoundary = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    atHourUtc,
    atMinuteUtc,
    0,
    0,
  );
  return nowMs >= todayBoundary ? todayBoundary : todayBoundary - DAY_MS;
}

/**
 * Is this schedule due to fire? `lastRunAtMs` is the automation's most recent run
 * time (null if it has never run).
 *   - interval: due when it has never run, or a full interval has elapsed.
 *   - daily: due when it hasn't run since the most recent scheduled boundary.
 */
export function isScheduleDue(
  schedule: ScheduleSpec,
  lastRunAtMs: number | null,
  nowMs: number,
): boolean {
  if (schedule.kind === "interval") {
    if (lastRunAtMs == null) return true;
    return nowMs - lastRunAtMs >= schedule.everyMinutes * MINUTE_MS;
  }
  // daily
  const boundary = lastDailyBoundary(schedule.atHourUtc, schedule.atMinuteUtc ?? 0, nowMs);
  if (lastRunAtMs == null) return true;
  return lastRunAtMs < boundary;
}
