/**
 * Unit tests for executeWorkflow's run-state lifecycle (foreman-2afc): a run row
 * must never get stuck in 'running' — not on step failure, and not when the
 * caller abandons the generator mid-stream. runAction is mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let stepsResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
const updates: { table: string; payload: any }[] = [];

function createChain(table: string) {
  const b: any = {};
  for (const m of ["select", "eq", "order", "insert", "update"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  b.then = (resolve: any) => {
    if (b._verb === "insert") return resolve({ error: null });
    if (b._verb === "update") return resolve({ error: null });
    if (table === "workflow_step") return resolve(stepsResult);
    return resolve({ data: null, error: null });
  };
  const oi = b.insert;
  b.insert = vi.fn((p: any) => {
    b._verb = "insert";
    return oi(p);
  });
  const ou = b.update;
  b.update = vi.fn((p: any) => {
    b._verb = "update";
    updates.push({ table, payload: p });
    return ou(p);
  });
  return b;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };
vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

const mockRunAction = vi.fn();
vi.mock("@/lib/zapier/execution", () => ({
  runAction: (...args: unknown[]) => mockRunAction(...args),
}));

const oneStep = [
  {
    id: "s-1",
    proposal_template: JSON.stringify({
      humanLabel: "Send",
      inputs: {},
      appKey: "gmail",
      actionType: "write",
      actionKey: "send_email",
    }),
  },
];

const statuses = () =>
  updates.filter((u) => u.table === "workflow_run").map((u) => u.payload.status);

describe("executeWorkflow run-state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stepsResult = { data: oneStep, error: null };
    updates.length = 0;
  });

  it("marks the run failed when a step throws (no stuck 'running')", async () => {
    mockRunAction.mockRejectedValue(new Error("boom"));
    const { executeWorkflow } = await import("@/lib/workflows/engine");

    const events: string[] = [];
    for await (const ev of executeWorkflow("wf-1", "user-1", {})) events.push(ev.type);

    expect(statuses()).toEqual(["failed"]); // exactly one terminal write, not stuck
    expect(events).toContain("error");
  });

  it("marks the run success when all steps complete", async () => {
    mockRunAction.mockResolvedValue({ ok: true });
    const { executeWorkflow } = await import("@/lib/workflows/engine");

    for await (const ev of executeWorkflow("wf-1", "user-1", {})) void ev;

    // success terminal write, and the finally must NOT add a spurious 'failed'
    expect(statuses()).toEqual(["success"]);
  });

  it("marks the run failed when the caller abandons the generator mid-stream", async () => {
    // runAction would hang, but the caller breaks before it's reached.
    mockRunAction.mockReturnValue(new Promise(() => {}));
    const { executeWorkflow } = await import("@/lib/workflows/engine");

    for await (const ev of executeWorkflow("wf-1", "user-1", {})) {
      if (ev.type === "status") break; // abandon — triggers the generator's finally
    }

    expect(statuses()).toEqual(["failed"]); // finally rescued the orphaned run
  });
});
