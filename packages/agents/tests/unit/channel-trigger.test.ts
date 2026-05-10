/**
 * Unit tests for matchAndFireChannelTriggers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result<T> = { data: T; error: { message: string } | null };
let triggerListResult: Result<unknown[]> = { data: [], error: null };
let workflowSelectResult: Result<unknown> = { data: null, error: null };

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
    return origUpdate(payload);
  });
  return builder;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };

vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

const mockExecuteWorkflow = vi.fn();
vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
}));

async function* gen(events: unknown[]): AsyncGenerator<any> {
  for (const e of events) yield e;
}

describe("matchAndFireChannelTriggers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    triggerListResult = { data: [], error: null };
    workflowSelectResult = { data: { user_id: "user-1" }, error: null };
    mockExecuteWorkflow.mockReturnValue(gen([{ type: "complete" }]));
  });

  it("fires when channel + command match", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-1",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup" },
          }),
        },
      ],
      error: null,
    };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(1);
  });

  it("tolerates leading slashes and whitespace in command match", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-1",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup" },
          }),
        },
      ],
      error: null,
    };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "  /standup  ",
      from: "U123",
    });
    expect(fired).toBe(1);
  });

  it("skips when channel differs", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-1",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup" },
          }),
        },
      ],
      error: null,
    };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "discord",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(0);
  });

  it("skips when from regex doesn't match", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-1",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup", from: "^U999" },
          }),
        },
      ],
      error: null,
    };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(0);
  });

  it("skips when room differs", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-1",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup", room: "#ops" },
          }),
        },
      ],
      error: null,
    };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
      room: "#random",
    });
    expect(fired).toBe(0);
  });

  it("skips when workflow has been deleted", async () => {
    triggerListResult = {
      data: [
        {
          id: "t-1",
          workflow_id: "wf-deleted",
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup" },
          }),
        },
      ],
      error: null,
    };
    workflowSelectResult = { data: null, error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(0);
  });
});
