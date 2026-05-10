/**
 * Unit tests for attach_trigger / list_workflow_triggers / detach_trigger.
 *
 * Same shape as workflow-tools-rud.test.ts: mock Supabase via a thenable
 * builder, then call tool.execute(input, { requestContext }) and assert.
 */
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result<T> = { data: T; error: { message: string } | null };
let nextSelectResult: Result<unknown> = { data: null, error: null };
let nextListResult: Result<unknown[]> = { data: [], error: null };
let nextInsertResult: Result<unknown> = { data: null, error: null };
let nextDeleteResult: Result<unknown> = { data: null, error: null };

let lastInsertPayload: any = null;

function createChain(_table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "limit", "insert", "delete", "order"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(nextSelectResult));
  // biome-ignore lint/suspicious/noThenProperty: thenable mock for await chains
  builder.then = (resolve: any) => {
    if (builder._lastVerb === "delete") return resolve(nextDeleteResult);
    if (builder._lastVerb === "insert") return resolve(nextInsertResult);
    if (builder._lastVerb === "list") return resolve(nextListResult);
    return resolve(nextSelectResult);
  };
  const origInsert = builder.insert;
  builder.insert = vi.fn((payload: unknown) => {
    builder._lastVerb = "insert";
    lastInsertPayload = payload;
    return origInsert(payload);
  });
  const origDelete = builder.delete;
  builder.delete = vi.fn((...args: unknown[]) => {
    builder._lastVerb = "delete";
    return origDelete(...args);
  });
  const origOrder = builder.order;
  builder.order = vi.fn((...args: unknown[]) => {
    builder._lastVerb = "list";
    return origOrder(...args);
  });
  return builder;
}

const mockSupabase = {
  from: vi.fn((table: string) => createChain(table)),
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

function ctx({ userId }: { userId?: string }) {
  const entries: [string, string][] = [];
  if (userId) entries.push(["userId", userId]);
  return { requestContext: new RequestContext(entries) } as any;
}

describe("attach_trigger tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextInsertResult = { data: null, error: null };
    lastInsertPayload = null;
  });

  it("attaches a cron trigger", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const out = await attachTriggerTool.execute!(
      {
        workflowId: "wf-1",
        type: "cron",
        cron: { schedule: "0 9 * * 1-5" },
      } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.type).toBe("cron");
    expect(out.enabled).toBe(true);
    expect(lastInsertPayload).toMatchObject({
      workflow_id: "wf-1",
      type: "cron",
    });
    expect(JSON.parse(lastInsertPayload.config)).toEqual({ schedule: "0 9 * * 1-5" });
  });

  it("attaches a channel trigger", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const out = await attachTriggerTool.execute!(
      {
        workflowId: "wf-1",
        type: "channel",
        channel: { channel: "slack", match: { command: "!standup" } },
      } as any,
      ctx({ userId: "user-1" }),
    );

    expect(out.type).toBe("channel");
    expect(JSON.parse(lastInsertPayload.config)).toMatchObject({
      channel: "slack",
      match: { command: "!standup" },
    });
  });

  it("throws when matching config field is missing", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    await expect(
      attachTriggerTool.execute!(
        { workflowId: "wf-1", type: "cron" } as any,
        ctx({ userId: "user-1" }),
      ),
    ).rejects.toThrow(/requires the matching/);
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    await expect(
      attachTriggerTool.execute!(
        {
          workflowId: "missing",
          type: "cron",
          cron: { schedule: "0 * * * *" },
        } as any,
        ctx({ userId: "user-1" }),
      ),
    ).rejects.toThrow(/not found/);
  });

  it("throws when userId is missing", async () => {
    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    await expect(
      attachTriggerTool.execute!(
        { workflowId: "wf-1", type: "cron", cron: { schedule: "0 * * * *" } } as any,
        ctx({}),
      ),
    ).rejects.toThrow(/userId/);
  });
});

describe("list_workflow_triggers tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextListResult = { data: [], error: null };
  });

  it("lists triggers for a workflow", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    nextListResult = {
      data: [
        {
          id: "trig-1",
          type: "cron",
          enabled: true,
          config: JSON.stringify({ schedule: "0 9 * * 1-5" }),
          last_fired_at: null,
        },
      ],
      error: null,
    };

    const { listWorkflowTriggersTool } = await import("@/mastra/tools/list-workflow-triggers");
    const out = (await listWorkflowTriggersTool.execute!(
      { workflowId: "wf-1" } as any,
      ctx({ userId: "user-1" }),
    )) as { triggers: any[] };

    expect(out.triggers).toHaveLength(1);
    expect(out.triggers[0]).toMatchObject({
      id: "trig-1",
      type: "cron",
      enabled: true,
      lastFiredAt: null,
    });
    expect(out.triggers[0].config).toEqual({ schedule: "0 9 * * 1-5" });
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { listWorkflowTriggersTool } = await import("@/mastra/tools/list-workflow-triggers");
    await expect(
      listWorkflowTriggersTool.execute!(
        { workflowId: "missing" } as any,
        ctx({ userId: "user-1" }),
      ),
    ).rejects.toThrow(/not found/);
  });
});

describe("detach_trigger tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nextSelectResult = { data: null, error: null };
    nextDeleteResult = { data: null, error: null };
  });

  it("deletes when workflow + trigger exist", async () => {
    nextSelectResult = { data: { id: "wf-1" }, error: null };
    nextDeleteResult = { data: null, error: null };

    const { detachTriggerTool } = await import("@/mastra/tools/detach-trigger");
    const out = await detachTriggerTool.execute!(
      { workflowId: "wf-1", triggerId: "trig-1" } as any,
      ctx({ userId: "user-1" }),
    );
    expect(out).toEqual({ deleted: true });
  });

  it("throws when workflow not found", async () => {
    nextSelectResult = { data: null, error: null };
    const { detachTriggerTool } = await import("@/mastra/tools/detach-trigger");
    await expect(
      detachTriggerTool.execute!(
        { workflowId: "missing", triggerId: "trig-1" } as any,
        ctx({ userId: "user-1" }),
      ),
    ).rejects.toThrow(/not found/);
  });
});
