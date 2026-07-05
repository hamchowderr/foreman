/**
 * Unit tests for daily digest synthesis (foreman-ufo3.2). Pure aggregation —
 * no SDK, no DB.
 */
import { describe, expect, it } from "vitest";
import { buildDigest, DIGEST_KIND, type DigestInputRun } from "../../src/lib/automations/digest";

const START = "2026-07-04T12:00:00Z";
const END = "2026-07-05T12:00:00Z";

function run(o: Partial<DigestInputRun> & { status: string }): DigestInputRun {
  return {
    automationId: o.automationId ?? "auto_1",
    automationName: o.automationName ?? "Some automation",
    status: o.status,
    error: o.error,
    createdAt: o.createdAt ?? "2026-07-05T09:00:00Z",
  };
}

describe("buildDigest", () => {
  it("summarizes an empty period", () => {
    const d = buildDigest([], START, END);
    expect(d.kind).toBe(DIGEST_KIND);
    expect(d.totals.total).toBe(0);
    expect(d.headline).toBe("No automation activity in the last day");
    expect(d.failures).toEqual([]);
  });

  it("counts by status and leads the headline with failures", () => {
    const d = buildDigest(
      [
        run({ status: "finished" }),
        run({ status: "finished" }),
        run({ status: "failed", automationName: "Sync", error: { message: "boom" } }),
        run({ status: "waiting", automationName: "Approve me" }),
        run({ status: "retrying" }),
        run({ status: "started" }),
        run({ status: "cancelled" }),
      ],
      START,
      END,
    );
    expect(d.totals).toEqual({
      total: 7,
      finished: 2,
      failed: 1,
      waiting: 1,
      retrying: 1,
      other: 2, // started + cancelled
    });
    expect(d.headline).toBe("7 runs · 1 failed · 1 waiting for approval · 1 retrying · 2 ok");
    expect(d.failures[0]).toMatchObject({ automationName: "Sync", error: "boom" });
    expect(d.waiting[0]).toMatchObject({ automationName: "Approve me" });
  });

  it("extracts an error from a DurableRunDetail shape", () => {
    const d = buildDigest(
      [run({ status: "failed", error: { lastError: { title: "step timed out" } } })],
      START,
      END,
    );
    expect(d.failures[0].error).toBe("step timed out");
  });

  it("tolerates a missing/odd error payload", () => {
    const d = buildDigest([run({ status: "failed", error: null })], START, END);
    expect(d.failures[0].error).toBeNull();
  });

  it("orders each bucket most-recent-first", () => {
    const d = buildDigest(
      [
        run({ status: "failed", automationName: "old", createdAt: "2026-07-05T01:00:00Z" }),
        run({ status: "failed", automationName: "new", createdAt: "2026-07-05T11:00:00Z" }),
      ],
      START,
      END,
    );
    expect(d.failures.map((f) => f.automationName)).toEqual(["new", "old"]);
  });

  it("singularizes the run count", () => {
    const d = buildDigest([run({ status: "finished" })], START, END);
    expect(d.headline).toBe("1 run · 1 ok");
  });
});
