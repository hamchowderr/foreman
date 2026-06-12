/**
 * Unit tests for the cron driver — schedule matcher + tick dispatch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase + engine mocks ─────────────────────────────────────────────────

type Result<T> = { data: T; error: { message: string } | null };
let triggerListResult: Result<unknown[]> = { data: [], error: null };
let workflowSelectResult: Result<unknown> = { data: null, error: null };
// Result of the atomic same-minute claim (`update ... .select("id")`). A
// non-empty array means the claim succeeded; empty means another tick already
// fired this minute.
let claimResult: Result<unknown[]> = { data: [{ id: "trig-1" }], error: null };
const updates: any[] = [];

function createChain(table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "limit", "update", "or"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(workflowSelectResult));
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  builder.then = (resolve: any) => {
    if (builder._verb === "update") return resolve(claimResult);
    if (table === "workflow_trigger") return resolve(triggerListResult);
    return resolve({ data: null, error: null });
  };
  const origUpdate = builder.update;
  builder.update = vi.fn((payload: any) => {
    builder._verb = "update";
    updates.push({ table, payload });
    return origUpdate(payload);
  });
  return builder;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

const mockExecuteWorkflow = vi.fn();
vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
}));

async function* gen(events: unknown[]): AsyncGenerator<any> {
  for (const e of events) yield e;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("cronMatches", () => {
  it("matches *  *  *  *  * (every minute)", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    expect(cronMatches("* * * * *", new Date("2026-05-10T12:34:00Z"))).toBe(true);
  });

  it("matches an exact minute and hour", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    expect(cronMatches("30 14 * * *", new Date("2026-05-10T14:30:00Z"))).toBe(true);
    expect(cronMatches("30 14 * * *", new Date("2026-05-10T14:31:00Z"))).toBe(false);
  });

  it("matches weekday range (Mon-Fri at 09:00)", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    // 2026-05-11 is a Monday
    expect(cronMatches("0 9 * * 1-5", new Date("2026-05-11T09:00:00Z"))).toBe(true);
    // 2026-05-09 is a Saturday
    expect(cronMatches("0 9 * * 1-5", new Date("2026-05-09T09:00:00Z"))).toBe(false);
  });

  it("matches step values (every 15 min)", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    expect(cronMatches("*/15 * * * *", new Date("2026-05-10T12:00:00Z"))).toBe(true);
    expect(cronMatches("*/15 * * * *", new Date("2026-05-10T12:15:00Z"))).toBe(true);
    expect(cronMatches("*/15 * * * *", new Date("2026-05-10T12:07:00Z"))).toBe(false);
  });

  it("matches comma list", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    expect(cronMatches("0,30 9 * * *", new Date("2026-05-10T09:00:00Z"))).toBe(true);
    expect(cronMatches("0,30 9 * * *", new Date("2026-05-10T09:30:00Z"))).toBe(true);
    expect(cronMatches("0,30 9 * * *", new Date("2026-05-10T09:15:00Z"))).toBe(false);
  });

  it("respects timezone (LA 9am ≠ UTC 9am)", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    // 2026-05-12 16:00 UTC == 09:00 PDT
    expect(cronMatches("0 9 * * *", new Date("2026-05-12T16:00:00Z"), "America/Los_Angeles")).toBe(
      true,
    );
    expect(cronMatches("0 9 * * *", new Date("2026-05-12T09:00:00Z"), "America/Los_Angeles")).toBe(
      false,
    );
  });

  it("normalizes dow=7 to Sunday", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    // 2026-05-10 is a Sunday
    expect(cronMatches("0 12 * * 7", new Date("2026-05-10T12:00:00Z"))).toBe(true);
    expect(cronMatches("0 12 * * 0", new Date("2026-05-10T12:00:00Z"))).toBe(true);
  });

  it("rejects malformed expressions", async () => {
    const { cronMatches } = await import("@/workflows/cron-driver");
    expect(() => cronMatches("0 9 * *", new Date())).toThrow(/5 fields/);
  });
});

describe("tickCron", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    triggerListResult = { data: [], error: null };
    workflowSelectResult = { data: null, error: null };
    claimResult = { data: [{ id: "trig-1" }], error: null };
    updates.length = 0;
    mockExecuteWorkflow.mockReset();
  });

  it("fires a matching cron and updates last_fired_at", async () => {
    triggerListResult = {
      data: [
        {
          id: "trig-1",
          workflow_id: "wf-1",
          config: JSON.stringify({ schedule: "* * * * *" }),
          last_fired_at: null,
        },
      ],
      error: null,
    };
    workflowSelectResult = { data: { user_id: "user-1" }, error: null };
    mockExecuteWorkflow.mockReturnValue(gen([{ type: "complete", runId: "run-1" }]));

    const { tickCron } = await import("@/workflows/cron-driver");
    const out = await tickCron(new Date("2026-05-10T12:00:30Z"));

    expect(out.fired).toBe(1);
    // wait a microtask for the void runOne to start
    await new Promise((r) => setTimeout(r, 10));
    expect(updates.find((u) => u.table === "workflow_trigger")).toBeTruthy();
  });

  it("does not double-fire when the atomic claim is lost (same-minute restart)", async () => {
    triggerListResult = {
      data: [
        {
          id: "trig-1",
          workflow_id: "wf-1",
          config: JSON.stringify({ schedule: "* * * * *" }),
          last_fired_at: "2026-05-10T12:00:00.000Z",
        },
      ],
      error: null,
    };
    workflowSelectResult = { data: { user_id: "user-1" }, error: null };
    // The conditional UPDATE matches no row — another tick already claimed this
    // minute. The driver must NOT fire.
    claimResult = { data: [], error: null };
    mockExecuteWorkflow.mockReturnValue(gen([{ type: "complete" }]));

    const { tickCron } = await import("@/workflows/cron-driver");
    const out = await tickCron(new Date("2026-05-10T12:00:30Z"));
    expect(out.fired).toBe(0);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it("skips a non-matching schedule", async () => {
    triggerListResult = {
      data: [
        {
          id: "trig-1",
          workflow_id: "wf-1",
          config: JSON.stringify({ schedule: "0 9 * * *" }),
          last_fired_at: null,
        },
      ],
      error: null,
    };

    const { tickCron } = await import("@/workflows/cron-driver");
    const out = await tickCron(new Date("2026-05-10T12:00:00Z"));
    expect(out.fired).toBe(0);
  });

  it("skips a trigger whose workflow is missing", async () => {
    triggerListResult = {
      data: [
        {
          id: "trig-1",
          workflow_id: "wf-deleted",
          config: JSON.stringify({ schedule: "* * * * *" }),
          last_fired_at: null,
        },
      ],
      error: null,
    };
    workflowSelectResult = { data: null, error: null };

    const { tickCron } = await import("@/workflows/cron-driver");
    const out = await tickCron(new Date("2026-05-10T12:00:00Z"));
    expect(out.fired).toBe(0);
  });
});
