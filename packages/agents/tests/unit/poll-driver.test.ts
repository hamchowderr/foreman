/**
 * Unit tests for the poll driver — baseline, diff-by-dedupeKey, cursor advance,
 * and the interval gate. No network: runAction + executeWorkflow are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase + engine + zapier mocks ────────────────────────────────────────

type Result<T> = { data: T; error: { message: string } | null };
let triggerListResult: Result<unknown[]> = { data: [], error: null };
let workflowSelectResult: Result<unknown> = { data: null, error: null };
const updates: { table: string; payload: any }[] = [];

function createChain(table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "limit", "update"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(workflowSelectResult));
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  builder.then = (resolve: any) => {
    if (builder._verb === "update") return resolve({ data: null, error: null });
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
vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

const mockRunAction = vi.fn();
vi.mock("@/lib/zapier/execution", () => ({
  runAction: (...args: unknown[]) => mockRunAction(...args),
}));

const mockExecuteWorkflow = vi.fn();
vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
}));

async function* gen(events: unknown[] = [{ type: "complete" }]): AsyncGenerator<any> {
  for (const e of events) yield e;
}

function pollRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "trig-1",
    workflow_id: "wf-1",
    config: JSON.stringify({
      app: "gmail",
      action: "new_email",
      dedupeKey: "id",
      intervalMinutes: 5,
    }),
    last_fired_at: null,
    last_dedupe_key: null,
    ...over,
  };
}

const lastTriggerUpdate = () =>
  [...updates].reverse().find((u) => u.table === "workflow_trigger")?.payload;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("tickPoll", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    triggerListResult = { data: [], error: null };
    workflowSelectResult = { data: { user_id: "user-1" }, error: null };
    updates.length = 0;
    mockExecuteWorkflow.mockReturnValue(gen());
  });

  it("first poll establishes the baseline — fires nothing, sets the cursor to newest", async () => {
    triggerListResult = { data: [pollRow({ last_dedupe_key: null })], error: null };
    mockRunAction.mockResolvedValue({ data: [{ id: "3" }, { id: "2" }, { id: "1" }] });

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.polled).toBe(1);
    expect(out.fired).toBe(0);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
    expect(lastTriggerUpdate()?.last_dedupe_key).toBe("3");
  });

  it("fires once per new record above the cursor, oldest-first, then advances", async () => {
    triggerListResult = { data: [pollRow({ last_dedupe_key: "1" })], error: null };
    // newest-first page; cursor is "1", so "3" and "2" are new
    mockRunAction.mockResolvedValue({ data: [{ id: "3" }, { id: "2" }, { id: "1" }] });

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.fired).toBe(2);
    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(2);
    // oldest-first: "2" fired before "3"
    expect(mockExecuteWorkflow.mock.calls[0][2]).toMatchObject({ id: "2" });
    expect(mockExecuteWorkflow.mock.calls[1][2]).toMatchObject({ id: "3" });
    expect(lastTriggerUpdate()?.last_dedupe_key).toBe("3");
  });

  it("fires nothing when the newest record equals the cursor (no new data)", async () => {
    triggerListResult = { data: [pollRow({ last_dedupe_key: "3" })], error: null };
    mockRunAction.mockResolvedValue({ data: [{ id: "3" }, { id: "2" }] });

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.fired).toBe(0);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it("respects the interval gate — skips a trigger polled too recently", async () => {
    triggerListResult = {
      data: [pollRow({ last_dedupe_key: "1", last_fired_at: "2026-05-10T12:00:00.000Z" })],
      error: null,
    };
    mockRunAction.mockResolvedValue({ data: [{ id: "9" }, { id: "1" }] });

    const { tickPoll } = await import("@/workflows/poll-driver");
    // only 2 minutes later, intervalMinutes is 5 → not due
    const out = await tickPoll(new Date("2026-05-10T12:02:00Z"));

    expect(out.polled).toBe(0);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it("polls again once the interval has elapsed", async () => {
    triggerListResult = {
      data: [pollRow({ last_dedupe_key: "1", last_fired_at: "2026-05-10T12:00:00.000Z" })],
      error: null,
    };
    mockRunAction.mockResolvedValue({ data: [{ id: "9" }, { id: "1" }] });

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:06:00Z"));

    expect(out.polled).toBe(1);
    expect(out.fired).toBe(1);
  });

  it("skips a trigger missing app/action/dedupeKey", async () => {
    triggerListResult = {
      data: [pollRow({ config: JSON.stringify({ app: "gmail", action: "new_email" }) })],
      error: null,
    };

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.polled).toBe(0);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it("does not fire when a guardrail demands confirmation", async () => {
    triggerListResult = { data: [pollRow({ last_dedupe_key: "1" })], error: null };
    mockRunAction.mockResolvedValue({ __guardrail_confirmation_required: true });

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.fired).toBe(0);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it("handles a bare-array read result (no data wrapper)", async () => {
    triggerListResult = { data: [pollRow({ last_dedupe_key: "1" })], error: null };
    mockRunAction.mockResolvedValue([{ id: "2" }, { id: "1" }]);

    const { tickPoll } = await import("@/workflows/poll-driver");
    const out = await tickPoll(new Date("2026-05-10T12:00:00Z"));

    expect(out.fired).toBe(1);
    expect(mockExecuteWorkflow.mock.calls[0][2]).toMatchObject({ id: "2" });
  });
});
