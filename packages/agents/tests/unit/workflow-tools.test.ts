/**
 * Unit tests for the save_workflow / list_workflows / get_workflow agent tools.
 *
 * Each tool is verified at the boundary it actually has — they read userId +
 * threadId from the RequestContext, then either delegate to
 * saveWorkflowFromConversation (save) or query Supabase directly (list, get).
 */
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock ───────────────────────────────────────────────────────────

type Result<T> = { data: T; error: { message: string } | null };
let nextSelectResult: Result<unknown> = { data: null, error: null };
let nextStepsResult: Result<unknown> = { data: [], error: null };

function createChain(table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(nextSelectResult));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => {
    // workflow_step queries return the steps fixture; everything else returns the main fixture
    resolve(table === "workflow_step" ? nextStepsResult : nextSelectResult);
  };
  return builder;
}

const mockSupabase = {
  from: vi.fn((table: string) => createChain(table)),
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

// ─── saveWorkflowFromConversation mock — save_workflow delegates to it ───────

const mockSaveFromConv = vi.fn();
vi.mock("@/lib/workflows/save", () => ({
  saveWorkflowFromConversation: (...args: unknown[]) => mockSaveFromConv(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ctx({ userId, threadId }: { userId?: string; threadId?: string }) {
  const entries: [string, string][] = [];
  if (userId) entries.push(["userId", userId]);
  if (threadId) entries.push(["threadId", threadId]);
  return { requestContext: new RequestContext(entries) } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("save_workflow tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSaveFromConv.mockReset();
  });

  it("delegates to saveWorkflowFromConversation with userId + threadId from request context", async () => {
    mockSaveFromConv.mockResolvedValue({
      workflowId: "wf-123",
      steps: 2,
      parameters: ["recipient_email"],
    });

    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const out = await saveWorkflowTool.execute!(
      { name: "Test workflow" } as any,
      ctx({ userId: "user-1", threadId: "conv-9" }),
    );

    expect(mockSaveFromConv).toHaveBeenCalledWith("conv-9", "user-1", "Test workflow");
    expect(out).toEqual({
      workflowId: "wf-123",
      steps: 2,
      parameters: ["recipient_email"],
    });
  });

  it("throws when userId is missing", async () => {
    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    await expect(
      saveWorkflowTool.execute!({ name: "x" } as any, ctx({ threadId: "conv-9" })),
    ).rejects.toThrow(/userId/);
  });

  it("throws when conversation thread id is missing", async () => {
    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    await expect(
      saveWorkflowTool.execute!({ name: "x" } as any, ctx({ userId: "u" })),
    ).rejects.toThrow(/conversation thread id/);
  });
});

describe("list_workflows tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: [], error: null };
  });

  it("returns the user's workflows shaped for the model", async () => {
    nextSelectResult = {
      data: [
        {
          id: "wf-a",
          name: "Daily standup",
          parameters: '["recipient"]',
          updated_at: "2026-05-10T10:00:00Z",
        },
        {
          id: "wf-b",
          name: "Invoice notify",
          parameters: "[]",
          updated_at: "2026-05-09T10:00:00Z",
        },
      ],
      error: null,
    };

    const { listWorkflowsTool } = await import("@/mastra/tools/list-workflows");
    const out = await listWorkflowsTool.execute!({ limit: 20 } as any, ctx({ userId: "user-1" }));

    expect(out.workflows).toEqual([
      {
        id: "wf-a",
        name: "Daily standup",
        parameters: ["recipient"],
        updatedAt: "2026-05-10T10:00:00Z",
      },
      {
        id: "wf-b",
        name: "Invoice notify",
        parameters: [],
        updatedAt: "2026-05-09T10:00:00Z",
      },
    ]);
  });

  it("returns empty list when the user has none", async () => {
    nextSelectResult = { data: [], error: null };
    const { listWorkflowsTool } = await import("@/mastra/tools/list-workflows");
    const out = await listWorkflowsTool.execute!({ limit: 20 } as any, ctx({ userId: "user-1" }));
    expect(out.workflows).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    nextSelectResult = { data: null, error: { message: "boom" } };
    const { listWorkflowsTool } = await import("@/mastra/tools/list-workflows");
    await expect(
      listWorkflowsTool.execute!({ limit: 20 } as any, ctx({ userId: "u" })),
    ).rejects.toThrow(/boom/);
  });
});

describe("get_workflow tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextStepsResult = { data: [], error: null };
  });

  it("returns workflow with parsed steps", async () => {
    nextSelectResult = {
      data: {
        id: "wf-1",
        name: "Daily standup",
        parameters: '["recipient_email"]',
        created_at: "2026-05-10T09:00:00Z",
        updated_at: "2026-05-10T10:00:00Z",
      },
      error: null,
    };
    nextStepsResult = {
      data: [
        {
          order: 0,
          proposal_template: JSON.stringify({
            appKey: "slack",
            actionType: "write",
            actionKey: "send_message",
            humanLabel: "Post to #ops",
            inputs: { channel: "#ops", text: "standup in 5" },
          }),
        },
      ],
      error: null,
    };

    const { getWorkflowTool } = await import("@/mastra/tools/get-workflow");
    const out = await getWorkflowTool.execute!(
      { workflowId: "wf-1" } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.id).toBe("wf-1");
    expect(out.parameters).toEqual(["recipient_email"]);
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0]).toMatchObject({
      order: 0,
      appKey: "slack",
      actionKey: "send_message",
      inputs: { channel: "#ops", text: "standup in 5" },
    });
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { getWorkflowTool } = await import("@/mastra/tools/get-workflow");
    await expect(
      getWorkflowTool.execute!({ workflowId: "missing" } as any, ctx({ userId: "u" })),
    ).rejects.toThrow(/not found/);
  });
});
