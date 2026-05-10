/**
 * Unit tests for run_workflow / update_workflow / delete_workflow.
 *
 * Same shape as workflow-tools.test.ts: mock Supabase + the workflow engine,
 * then call tool.execute(input, { requestContext }) and assert on shape.
 */
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock ───────────────────────────────────────────────────────────

type Result<T> = { data: T; error: { message: string } | null };
let nextSelectResult: Result<unknown> = { data: null, error: null };
let nextUpdateResult: Result<unknown> = { data: null, error: null };
let nextDeleteResult: Result<unknown> = { data: null, error: null };

function createChain(_table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "limit", "update", "delete"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(nextSelectResult));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => {
    // The builder may have entered "delete" or "update" state — choose result accordingly.
    // We pick by inspecting which mock was last invoked. Simple: track last verb.
    if (builder._lastVerb === "delete") return resolve(nextDeleteResult);
    if (builder._lastVerb === "update") return resolve(nextUpdateResult);
    return resolve(nextSelectResult);
  };
  // Wrap update / delete to remember the last verb so .then resolves with the right result.
  for (const verb of ["update", "delete"] as const) {
    const orig = builder[verb];
    builder[verb] = vi.fn((...args: unknown[]) => {
      builder._lastVerb = verb;
      return orig(...args);
    });
  }
  return builder;
}

const mockSupabase = {
  from: vi.fn((table: string) => createChain(table)),
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

// ─── executeWorkflow mock — run_workflow drains its yields ───────────────────

const mockExecuteWorkflow = vi.fn();
vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ctx({ userId }: { userId?: string }) {
  const entries: [string, string][] = [];
  if (userId) entries.push(["userId", userId]);
  return { requestContext: new RequestContext(entries) } as any;
}

async function* gen(events: unknown[]): AsyncGenerator<any> {
  for (const e of events) yield e;
}

// ─── run_workflow ────────────────────────────────────────────────────────────

describe("run_workflow tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecuteWorkflow.mockReset();
  });

  it("aggregates a successful run into a summary", async () => {
    mockExecuteWorkflow.mockReturnValue(
      gen([
        { type: "status", runId: "run-1", status: "running" },
        { type: "step", runId: "run-1", stepIndex: 0, status: "succeeded" },
        { type: "step", runId: "run-1", stepIndex: 1, status: "succeeded" },
        { type: "complete", runId: "run-1", status: "success" },
      ]),
    );

    const { runWorkflowTool } = await import("@/mastra/tools/run-workflow");
    const out = await runWorkflowTool.execute!(
      { workflowId: "wf-1", inputs: {} } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out).toMatchObject({ runId: "run-1", status: "success", stepsRun: 2, stepsFailed: 0 });
    expect(mockExecuteWorkflow).toHaveBeenCalledWith("wf-1", "user-1", {});
  });

  it("returns param_request when the engine emits one", async () => {
    mockExecuteWorkflow.mockReturnValue(
      gen([{ type: "param_request", missing: ["recipient_email"] }]),
    );

    const { runWorkflowTool } = await import("@/mastra/tools/run-workflow");
    const out = await runWorkflowTool.execute!(
      { workflowId: "wf-1", inputs: {} } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.status).toBe("param_request");
    expect(out.missingParams).toEqual(["recipient_email"]);
  });

  it("forwards inputs to the engine", async () => {
    mockExecuteWorkflow.mockReturnValue(gen([{ type: "complete", runId: "run-1" }]));

    const { runWorkflowTool } = await import("@/mastra/tools/run-workflow");
    await runWorkflowTool.execute!(
      { workflowId: "wf-1", inputs: { recipient_email: "a@b.com" } } as any,
      ctx({ userId: "user-1" }),
    );

    expect(mockExecuteWorkflow).toHaveBeenCalledWith("wf-1", "user-1", {
      recipient_email: "a@b.com",
    });
  });

  it("throws when userId is missing", async () => {
    const { runWorkflowTool } = await import("@/mastra/tools/run-workflow");
    await expect(
      runWorkflowTool.execute!({ workflowId: "wf-1", inputs: {} } as any, ctx({})),
    ).rejects.toThrow(/userId/);
  });
});

// ─── update_workflow ─────────────────────────────────────────────────────────

describe("update_workflow tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextUpdateResult = { data: null, error: null };
  });

  it("renames a workflow", async () => {
    nextSelectResult = {
      data: { id: "wf-1", name: "Old name", is_template: false },
      error: null,
    };
    nextUpdateResult = { data: null, error: null };

    const { updateWorkflowTool } = await import("@/mastra/tools/update-workflow");
    const out = await updateWorkflowTool.execute!(
      { workflowId: "wf-1", name: "New name" } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.id).toBe("wf-1");
    expect(out.name).toBe("New name");
    expect(out.isTemplate).toBe(false);
  });

  it("publishes as a template", async () => {
    nextSelectResult = {
      data: { id: "wf-1", name: "Daily standup", is_template: false },
      error: null,
    };
    nextUpdateResult = { data: null, error: null };

    const { updateWorkflowTool } = await import("@/mastra/tools/update-workflow");
    const out = await updateWorkflowTool.execute!(
      { workflowId: "wf-1", isTemplate: true } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.isTemplate).toBe(true);
    expect(out.name).toBe("Daily standup"); // unchanged
  });

  it("requires at least one field", async () => {
    const { updateWorkflowTool } = await import("@/mastra/tools/update-workflow");
    await expect(
      updateWorkflowTool.execute!({ workflowId: "wf-1" } as any, ctx({ userId: "u" })),
    ).rejects.toThrow(/at least one of/);
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { updateWorkflowTool } = await import("@/mastra/tools/update-workflow");
    await expect(
      updateWorkflowTool.execute!(
        { workflowId: "missing", name: "x" } as any,
        ctx({ userId: "u" }),
      ),
    ).rejects.toThrow(/not found/);
  });
});

// ─── delete_workflow ─────────────────────────────────────────────────────────

describe("delete_workflow tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextDeleteResult = { data: null, error: null };
  });

  it("deletes when the workflow exists", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    nextDeleteResult = { data: null, error: null };

    const { deleteWorkflowTool } = await import("@/mastra/tools/delete-workflow");
    const out = await deleteWorkflowTool.execute!(
      { workflowId: "wf-1" } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out).toEqual({ id: "wf-1", deleted: true });
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { deleteWorkflowTool } = await import("@/mastra/tools/delete-workflow");
    await expect(
      deleteWorkflowTool.execute!({ workflowId: "missing" } as any, ctx({ userId: "u" })),
    ).rejects.toThrow(/not found/);
  });
});
