/**
 * Unit tests for automation scheduling (foreman-ufo3.1). Pure functions —
 * no SDK, no DB, clock injected via nowMs.
 */
import { describe, expect, it } from "vitest";
import {
  isDigestTrigger,
  isScheduleDue,
  type ScheduleSpec,
  scheduleOf,
} from "../../src/lib/automations/schedule";

const MIN = 60_000;

describe("scheduleOf", () => {
  it("returns null for event triggers and junk", () => {
    expect(scheduleOf({ app: "gmail", action: "new_email" })).toBeNull();
    expect(scheduleOf(null)).toBeNull();
    expect(scheduleOf("nope")).toBeNull();
    expect(scheduleOf({ schedule: {} })).toBeNull();
  });

  it("parses a valid interval schedule", () => {
    expect(scheduleOf({ schedule: { kind: "interval", everyMinutes: 15 } })).toEqual({
      kind: "interval",
      everyMinutes: 15,
    });
  });

  it("rejects a sub-minute or non-integer interval", () => {
    expect(scheduleOf({ schedule: { kind: "interval", everyMinutes: 0 } })).toBeNull();
    expect(scheduleOf({ schedule: { kind: "interval", everyMinutes: 1.5 } })).toBeNull();
  });

  it("parses a daily schedule and defaults the minute to 0", () => {
    expect(scheduleOf({ schedule: { kind: "daily", atHourUtc: 9 } })).toEqual({
      kind: "daily",
      atHourUtc: 9,
      atMinuteUtc: 0,
    });
    expect(scheduleOf({ schedule: { kind: "daily", atHourUtc: 23, atMinuteUtc: 30 } })).toEqual({
      kind: "daily",
      atHourUtc: 23,
      atMinuteUtc: 30,
    });
  });

  it("rejects out-of-range daily hours/minutes", () => {
    expect(scheduleOf({ schedule: { kind: "daily", atHourUtc: 24 } })).toBeNull();
    expect(scheduleOf({ schedule: { kind: "daily", atHourUtc: 9, atMinuteUtc: 60 } })).toBeNull();
  });
});

describe("isDigestTrigger", () => {
  it("is true only for a scheduled trigger flagged digest", () => {
    expect(isDigestTrigger({ schedule: { kind: "daily", atHourUtc: 9 }, digest: true })).toBe(true);
    expect(isDigestTrigger({ schedule: { kind: "daily", atHourUtc: 9 } })).toBe(false);
    expect(isDigestTrigger({ app: "gmail", action: "x", digest: true })).toBe(false);
  });
});

describe("isScheduleDue — interval", () => {
  const every15: ScheduleSpec = { kind: "interval", everyMinutes: 15 };
  const now = Date.parse("2026-07-05T12:00:00Z");

  it("is due when it has never run", () => {
    expect(isScheduleDue(every15, null, now)).toBe(true);
  });

  it("is not due before a full interval elapses", () => {
    expect(isScheduleDue(every15, now - 10 * MIN, now)).toBe(false);
  });

  it("is due once the interval has elapsed", () => {
    expect(isScheduleDue(every15, now - 15 * MIN, now)).toBe(true);
    expect(isScheduleDue(every15, now - 20 * MIN, now)).toBe(true);
  });
});

describe("isScheduleDue — daily", () => {
  const at9: ScheduleSpec = { kind: "daily", atHourUtc: 9 };

  it("is due when it has never run", () => {
    expect(isScheduleDue(at9, null, Date.parse("2026-07-05T09:30:00Z"))).toBe(true);
  });

  it("is due after today's boundary if the last run was before it", () => {
    const now = Date.parse("2026-07-05T09:30:00Z");
    const lastRun = Date.parse("2026-07-04T09:05:00Z"); // yesterday's fire
    expect(isScheduleDue(at9, lastRun, now)).toBe(true);
  });

  it("is not due if it already ran after today's boundary", () => {
    const now = Date.parse("2026-07-05T12:00:00Z");
    const lastRun = Date.parse("2026-07-05T09:01:00Z"); // fired at 9 today
    expect(isScheduleDue(at9, lastRun, now)).toBe(false);
  });

  it("uses yesterday's boundary before today's scheduled time", () => {
    // 08:00 today — today's 09:00 boundary hasn't passed, so compare to yesterday 09:00.
    const now = Date.parse("2026-07-05T08:00:00Z");
    const ranYesterday = Date.parse("2026-07-04T09:02:00Z");
    expect(isScheduleDue(at9, ranYesterday, now)).toBe(false); // already ran since yesterday 09:00
    const ranTwoDaysAgo = Date.parse("2026-07-03T09:02:00Z");
    expect(isScheduleDue(at9, ranTwoDaysAgo, now)).toBe(true); // missed yesterday
  });
});
