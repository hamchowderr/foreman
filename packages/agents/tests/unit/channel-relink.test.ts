/**
 * `/link` moves a sender's existing channel threads onto the account they link to
 * (src/channels/relink.ts). Without the move, Mastra refuses every later message in
 * that chat (AGENT_MEMORY_THREAD_RESOURCE_MISMATCH): the thread still belongs to the
 * placeholder user the sender mapped to before linking.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/identity", () => ({
  resolveFromChannel: vi.fn(),
  redeemChannelLinkCode: vi.fn(),
  isChannelOnlyUser: vi.fn(),
}));

import { redeemLinkCodeAndRelink } from "@/channels/relink";
import { isChannelOnlyUser, redeemChannelLinkCode, resolveFromChannel } from "@/lib/identity";

function fakeMastra(threads: Array<{ id: string }>) {
  const memory = {
    listThreads: vi.fn(async () => ({ threads })),
    updateThreadResourceId: vi.fn(async () => ({})),
  };
  const mastra = { getStorage: () => ({ getStore: async () => memory }) };
  return { memory, mastra: mastra as never };
}

const args = (mastra: never) => ({
  code: "ABCD1234",
  platform: "slack",
  channelUserId: "U123",
  displayName: "Ada",
  chatThreadId: "slack:D1:",
  mastra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redeemChannelLinkCode).mockResolvedValue({ ok: true, userId: "web-user" });
});

describe("redeemLinkCodeAndRelink", () => {
  it("moves every thread on the platform from a channel-only placeholder", async () => {
    vi.mocked(resolveFromChannel).mockResolvedValue("placeholder");
    vi.mocked(isChannelOnlyUser).mockResolvedValue(true);
    const { memory, mastra } = fakeMastra([{ id: "t1" }, { id: "t2" }]);

    const result = await redeemLinkCodeAndRelink(args(mastra));

    expect(result).toEqual({ ok: true, userId: "web-user" });
    expect(memory.listThreads).toHaveBeenCalledWith({
      perPage: false,
      filter: { resourceId: "placeholder", metadata: { channel_platform: "slack" } },
    });
    expect(memory.updateThreadResourceId).toHaveBeenCalledWith({
      threadId: "t1",
      resourceId: "web-user",
    });
    expect(memory.updateThreadResourceId).toHaveBeenCalledWith({
      threadId: "t2",
      resourceId: "web-user",
    });
  });

  it("moves only the chat the code was typed in when re-linking a real account", async () => {
    // The previous owner has a web login and other conversations of their own.
    vi.mocked(resolveFromChannel).mockResolvedValue("other-web-user");
    vi.mocked(isChannelOnlyUser).mockResolvedValue(false);
    const { memory, mastra } = fakeMastra([{ id: "dm" }]);

    await redeemLinkCodeAndRelink(args(mastra));

    expect(memory.listThreads).toHaveBeenCalledWith({
      perPage: false,
      filter: {
        resourceId: "other-web-user",
        metadata: { channel_platform: "slack", channel_externalThreadId: "slack:D1:" },
      },
    });
  });

  it("moves nothing when the code is refused or the sender is new", async () => {
    const { memory, mastra } = fakeMastra([{ id: "t1" }]);

    vi.mocked(resolveFromChannel).mockResolvedValue("placeholder");
    vi.mocked(redeemChannelLinkCode).mockResolvedValueOnce({ ok: false, error: "expired" });
    expect(await redeemLinkCodeAndRelink(args(mastra))).toEqual({ ok: false, error: "expired" });

    vi.mocked(resolveFromChannel).mockResolvedValue(null);
    await redeemLinkCodeAndRelink(args(mastra));

    expect(memory.updateThreadResourceId).not.toHaveBeenCalled();
  });

  it("still reports the link when moving old threads fails", async () => {
    vi.mocked(resolveFromChannel).mockResolvedValue("placeholder");
    vi.mocked(isChannelOnlyUser).mockResolvedValue(true);
    const { memory, mastra } = fakeMastra([{ id: "t1" }]);
    memory.updateThreadResourceId.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await redeemLinkCodeAndRelink(args(mastra))).toEqual({ ok: true, userId: "web-user" });
    err.mockRestore();
  });
});
