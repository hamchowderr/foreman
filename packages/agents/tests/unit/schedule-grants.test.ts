/**
 * "Always allow" carries over to scheduled runs: saved on the conversation, then
 * honored only by a scheduled run in that conversation, only for that category.
 */
import { WORKSPACE_TOOLS } from "@mastra/core/workspace";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALWAYS_ALLOW_METADATA_KEY,
  approvalUnlessScheduledGrant,
  recordAlwaysAllow,
  SCHEDULE_THREAD_KEY,
  setScheduleGrantStore,
} from "@/mastra/lib/schedule-grants";

const { FILESYSTEM, SANDBOX } = WORKSPACE_TOOLS;

function fakeStore() {
  const threads = new Map<string, { id: string; title?: string; metadata?: any }>([
    ["t1", { id: "t1", title: "Chat", metadata: { keep: 1 } }],
    ["t2", { id: "t2", title: "Other", metadata: {} }],
  ]);
  return {
    threads,
    getThreadById: async ({ threadId }: { threadId: string }) => threads.get(threadId) ?? null,
    updateThread: async (t: { id: string; title?: string; metadata?: any }) => {
      threads.set(t.id, t);
      return t;
    },
  };
}

const needsApproval = (tool: string, requestContext: Record<string, unknown>) =>
  approvalUnlessScheduledGrant(tool)({ requestContext });

afterEach(() => setScheduleGrantStore(null));

describe("schedule grants", () => {
  it("saves the gated tool's category on the thread, keeping other metadata", async () => {
    const store = fakeStore();
    setScheduleGrantStore(store);
    await recordAlwaysAllow("t1", SANDBOX.EXECUTE_COMMAND);
    await recordAlwaysAllow("t1", SANDBOX.EXECUTE_COMMAND);
    expect(store.threads.get("t1")?.metadata).toEqual({
      keep: 1,
      [ALWAYS_ALLOW_METADATA_KEY]: ["execute"],
    });
  });

  it("never saves an uncategorized tool (Zapier writes, deletes)", async () => {
    const store = fakeStore();
    setScheduleGrantStore(store);
    await recordAlwaysAllow("t1", "create-table-records");
    await recordAlwaysAllow("t1", FILESYSTEM.DELETE);
    expect(store.threads.get("t1")?.metadata).toEqual({ keep: 1 });
  });

  it("skips approval only in a scheduled run on the granted thread and category", async () => {
    const store = fakeStore();
    setScheduleGrantStore(store);
    await recordAlwaysAllow("t1", SANDBOX.EXECUTE_COMMAND);

    expect(await needsApproval(SANDBOX.EXECUTE_COMMAND, { [SCHEDULE_THREAD_KEY]: "t1" })).toBe(
      false,
    );
    // Another category on the same thread still asks.
    expect(await needsApproval(FILESYSTEM.WRITE_FILE, { [SCHEDULE_THREAD_KEY]: "t1" })).toBe(true);
    // Another thread still asks.
    expect(await needsApproval(SANDBOX.EXECUTE_COMMAND, { [SCHEDULE_THREAD_KEY]: "t2" })).toBe(
      true,
    );
    // A chat run (no schedule thread) leaves it to the live session: it asks.
    expect(await needsApproval(SANDBOX.EXECUTE_COMMAND, { userId: "u1" })).toBe(true);
  });

  it("asks when the grant can't be read", async () => {
    setScheduleGrantStore({
      getThreadById: async () => {
        throw new Error("db down");
      },
      updateThread: async () => undefined,
    });
    expect(await needsApproval(SANDBOX.EXECUTE_COMMAND, { [SCHEDULE_THREAD_KEY]: "t1" })).toBe(
      true,
    );
  });
});
