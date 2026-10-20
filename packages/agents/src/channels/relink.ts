import type { Mastra } from "@mastra/core";
import {
  isChannelOnlyUser,
  type RedeemResult,
  redeemChannelLinkCode,
  resolveFromChannel,
} from "../lib/identity";

/**
 * Redeem a `/link CODE` from a channel and move the sender's existing channel
 * conversations onto the account they just linked to.
 *
 * Why the move is needed: a channel thread is owned by whoever the sender mapped
 * to when it was created. Someone who chatted before linking owns their threads
 * as a placeholder channel-only user. After linking, the same sender maps to
 * their web account, and Mastra refuses to run a thread for anyone but its owner
 * (AGENT_MEMORY_THREAD_RESOURCE_MISMATCH), so the DM would fail on every message.
 *
 * What moves:
 *  - Previous owner was a channel-only placeholder: every thread it owns on this
 *    platform. All of them came from this one channel account.
 *  - Previous owner was a real account (re-linking to a different one): only the
 *    chat the code was typed in. That account's other threads stay with it.
 */
export async function redeemLinkCodeAndRelink(args: {
  code: string;
  platform: string;
  channelUserId: string;
  displayName?: string;
  /** The chat thread the code was sent in (Chat SDK thread id). */
  chatThreadId: string;
  mastra?: Mastra;
}): Promise<RedeemResult> {
  const { code, platform, channelUserId, displayName, chatThreadId, mastra } = args;
  const previousUserId = await resolveFromChannel(platform, channelUserId);
  const result = await redeemChannelLinkCode(code, platform, channelUserId, displayName);
  if (!result.ok || !previousUserId || previousUserId === result.userId) return result;

  try {
    const moved = await moveChannelThreads({
      mastra,
      platform,
      chatThreadId,
      fromUserId: previousUserId,
      toUserId: result.userId,
      wholePlatform: await isChannelOnlyUser(previousUserId),
    });
    if (moved > 0) console.log(`[channels] /link moved ${moved} ${platform} thread(s)`);
  } catch (err) {
    // The link itself succeeded; a failed move only affects old conversations.
    console.error(`[channels] /link could not move ${platform} threads:`, err);
  }
  return result;
}

async function moveChannelThreads(args: {
  mastra?: Mastra;
  platform: string;
  chatThreadId: string;
  fromUserId: string;
  toUserId: string;
  wholePlatform: boolean;
}): Promise<number> {
  const memory = await args.mastra?.getStorage()?.getStore("memory");
  if (!memory) return 0;

  const { threads } = await memory.listThreads({
    perPage: false,
    filter: {
      resourceId: args.fromUserId,
      metadata: args.wholePlatform
        ? { channel_platform: args.platform }
        : { channel_platform: args.platform, channel_externalThreadId: args.chatThreadId },
    },
  });
  for (const thread of threads) {
    await memory.updateThreadResourceId({ threadId: thread.id, resourceId: args.toUserId });
  }
  return threads.length;
}
