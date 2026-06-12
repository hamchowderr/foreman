/**
 * Unit tests for matchAndFireChannelTriggers / ChannelTriggerSignalProvider —
 * matching, dedup (foreman-tv5p), and the notify() wiring.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockExecuteWorkflow = vi.fn();
vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
}));

async function* gen(events: unknown[]): AsyncGenerator<any> {
  for (const e of events) yield e;
}

const channelRow = (over: Record<string, unknown> = {}) => ({
  id: "t-1",
  workflow_id: "wf-1",
  config: JSON.stringify({ channel: "slack", match: { command: "!standup" } }),
  last_dedupe_key: null,
  ...over,
});

const lastTriggerUpdate = () =>
  [...updates].reverse().find((u) => u.table === "workflow_trigger")?.payload;

describe("matchAndFireChannelTriggers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    triggerListResult = { data: [], error: null };
    workflowSelectResult = { data: { user_id: "user-1" }, error: null };
    updates.length = 0;
    mockExecuteWorkflow.mockReturnValue(gen([{ type: "complete" }]));
  });

  it("fires when channel + command match", async () => {
    triggerListResult = { data: [channelRow()], error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(1);
  });

  it("tolerates leading slashes and whitespace in command match", async () => {
    triggerListResult = { data: [channelRow()], error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "  /standup  ",
      from: "U123",
    });
    expect(fired).toBe(1);
  });

  it("skips when channel differs", async () => {
    triggerListResult = { data: [channelRow()], error: null };

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
        channelRow({
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup", from: "^U999" },
          }),
        }),
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
        channelRow({
          config: JSON.stringify({
            channel: "slack",
            match: { command: "!standup", room: "#ops" },
          }),
        }),
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
    triggerListResult = { data: [channelRow({ workflow_id: "wf-deleted" })], error: null };
    workflowSelectResult = { data: null, error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(0);
  });

  // ─── Dedup (foreman-tv5p) ───────────────────────────────────────────────────

  it("skips a retried delivery whose dedupeKey already fired the trigger", async () => {
    triggerListResult = { data: [channelRow({ last_dedupe_key: "msg-42" })], error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
      dedupeKey: "msg-42",
    });
    expect(fired).toBe(0);
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it("fires a new delivery and records its dedupeKey", async () => {
    triggerListResult = { data: [channelRow({ last_dedupe_key: "msg-old" })], error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
      dedupeKey: "msg-new",
    });
    expect(fired).toBe(1);
    expect(lastTriggerUpdate()?.last_dedupe_key).toBe("msg-new");
  });

  it("derives a content-hash dedupeKey when none is supplied (records it)", async () => {
    triggerListResult = { data: [channelRow()], error: null };

    const { matchAndFireChannelTriggers } = await import("@/workflows/channel-trigger");
    const fired = await matchAndFireChannelTriggers({
      channel: "slack",
      text: "!standup",
      from: "U123",
    });
    expect(fired).toBe(1);
    // a real (40-char sha1 hex) key was persisted, not undefined
    expect(lastTriggerUpdate()?.last_dedupe_key).toMatch(/^[0-9a-f]{40}$/);
  });

  it("notify()s the owner's thread with the native dedupeKey on a fresh fire", async () => {
    triggerListResult = { data: [channelRow()], error: null };

    const { ChannelTriggerSignalProvider } = await import(
      "@/mastra/signals/channel-trigger-provider"
    );
    const provider = new ChannelTriggerSignalProvider();
    const sendNotificationSignal = vi.fn().mockResolvedValue(undefined);
    provider.connect({ sendNotificationSignal } as any);

    const fired = await provider.handleMessage({
      channel: "slack",
      text: "!standup",
      from: "U123",
      room: "#ops",
      dedupeKey: "msg-7",
    });

    expect(fired).toBe(1);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const [notification, target] = sendNotificationSignal.mock.calls[0];
    expect(notification).toMatchObject({ source: "channel-trigger", dedupeKey: "msg-7" });
    expect(target).toMatchObject({ threadId: "channel:slack:#ops", resourceId: "user-1" });
  });
});
