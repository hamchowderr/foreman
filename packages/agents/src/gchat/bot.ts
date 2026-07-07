import { createGoogleChatAdapter } from "@chat-adapter/gchat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { stepCountIs } from "ai";
import { Chat } from "chat";
import { registerChannelUser } from "../lib/identity";
import { requestUserContext } from "../lib/request-user-context";
import { getMastra } from "../mastra";

let _bot: Chat<{ gchat: ReturnType<typeof createGoogleChatAdapter> }> | undefined;
let _gchatAdapter: ReturnType<typeof createGoogleChatAdapter> | undefined;

/**
 * Create and configure the Google Chat bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Google Chat adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export async function getGoogleChatBot() {
  if (_bot) return _bot;

  const gchat = createGoogleChatAdapter();
  _gchatAdapter = gchat;

  const bot = new Chat({
    userName: "foreman",
    adapters: { gchat },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    gchatUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser("gchat", gchatUserId, displayName);

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from Google Chat, because resource is the same userId.
    const result = await requestUserContext.run({ userId }, () =>
      agent.generate(text, {
        stopWhen: stepCountIs(5),
        savePerStep: true,
        memory: {
          thread: `gchat-${threadId}`,
          resource: userId,
        },
      }),
    );
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[gchat] DM from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
      const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName,
      );
      console.log("[gchat] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[gchat] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[gchat] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName,
      );
      console.log("[gchat] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[gchat] Mention handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  bot.onSubscribedMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      await thread.startTyping().catch(() => {});
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName,
      );
      await thread.post(reply);
    } catch (err) {
      console.error("[gchat] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying Google Chat adapter instance.
 */
export function getGoogleChatAdapter() {
  if (!_gchatAdapter) getGoogleChatBot();
  return _gchatAdapter!;
}
