/**
 * Unit tests for inbox prioritization scoring (foreman-6r9y). Pure function —
 * no SDK, no network, clock injected via `now`.
 */
import { describe, expect, it } from "vitest";
import { type ScorableMessage, scoreInboxEntry } from "../../src/lib/automations/inbox-priority";

const NOW = Date.parse("2026-07-05T12:00:00Z");

function msg(
  o: {
    created_at?: string;
    status?: string;
    lease_count?: number;
    error_message?: string | null;
    possible_duplicate_data?: boolean;
  } = {},
): ScorableMessage {
  return {
    created_at: o.created_at ?? "2026-07-05T11:59:00Z",
    status: o.status ?? "pending",
    message_attributes: {
      lease_count: o.lease_count ?? 1,
      error_message: o.error_message ?? null,
      possible_duplicate_data: o.possible_duplicate_data ?? false,
    },
  };
}

const base = {
  automationStatus: "active",
  enabled: true,
  inboxStatus: "active" as string | null,
  inboxPausedReason: null as string | null,
  now: NOW,
};

describe("scoreInboxEntry", () => {
  it("is low priority when the inbox is quiet", () => {
    const p = scoreInboxEntry({ ...base, messages: [] });
    expect(p.score).toBe(0);
    expect(p.level).toBe("low");
    expect(p.reasons).toEqual([]);
  });

  it("flags a failing trigger as high priority", () => {
    const p = scoreInboxEntry({ ...base, automationStatus: "trigger_failed", messages: [] });
    expect(p.level).toBe("high");
    expect(p.reasons).toContain("trigger is failing");
  });

  it("scores a paused inbox and names the reason", () => {
    const p = scoreInboxEntry({
      ...base,
      inboxStatus: "paused",
      inboxPausedReason: "connection revoked",
      messages: [],
    });
    expect(p.score).toBe(20);
    expect(p.level).toBe("medium");
    expect(p.reasons).toContain("inbox paused: connection revoked");
  });

  it("weights errored messages heavily", () => {
    const p = scoreInboxEntry({ ...base, messages: [msg({ error_message: "boom" })] });
    // 15 (errored) + 3 (1 pending) = 18 → medium
    expect(p.score).toBe(18);
    expect(p.level).toBe("medium");
    expect(p.reasons).toContain("1 message errored");
  });

  it("flags redelivered (stuck) messages", () => {
    const p = scoreInboxEntry({ ...base, messages: [msg({ lease_count: 3 })] });
    expect(p.reasons).toContain("1 message stuck (redelivered)");
    // 10 (stuck) + 3 (pending) = 13
    expect(p.score).toBe(13);
  });

  it("adds urgency for stale pending backlog", () => {
    const p = scoreInboxEntry({
      ...base,
      messages: [msg({ created_at: "2026-07-05T06:00:00Z" })], // 6h old
    });
    // 3 (pending) + min(6,24)*2 = 3 + 12 = 15
    expect(p.score).toBe(15);
    expect(p.reasons).toContain("oldest pending ~6h old");
    expect(p.reasons).toContain("1 pending message");
  });

  it("does not count terminal messages as pending or stale", () => {
    const p = scoreInboxEntry({
      ...base,
      messages: [msg({ status: "processed", created_at: "2026-07-01T00:00:00Z" })],
    });
    expect(p.score).toBe(0);
    expect(p.reasons).toEqual([]);
  });

  it("surfaces duplicates as a note without inflating the score", () => {
    const p = scoreInboxEntry({
      ...base,
      messages: [msg({ status: "processed", possible_duplicate_data: true })],
    });
    expect(p.score).toBe(0);
    expect(p.reasons).toContain("1 possible duplicate");
  });

  it("notes a disabled automation", () => {
    const p = scoreInboxEntry({ ...base, enabled: false, messages: [] });
    expect(p.reasons).toContain("automation disabled");
  });

  it("caps per-signal contributions so one noisy inbox can't dominate", () => {
    const many = Array.from({ length: 50 }, () => msg({ error_message: "e", lease_count: 5 }));
    const p = scoreInboxEntry({ ...base, messages: many });
    // errored cap 5*15=75, stuck cap 5*10=50, pending cap 10*3=30 → 155 (finite, not 50×)
    expect(p.score).toBe(155);
    expect(p.level).toBe("high");
  });
});
