import { Chat } from "chat";
import { createLinearAdapter } from "@chat-adapter/linear";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ linear: ReturnType<typeof createLinearAdapter> }> | undefined;
let _linearAdapter: ReturnType<typeof createLinearAdapter> | undefined;

/**
 * Create and configure the Linear bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Linear adapter. Comment-based only — no cards/modals.
 * The bot is a singleton — safe to call multiple times.
 */
export function getLinearBot() {
  if (_bot) return _bot;

  const linear = createLinearAdapter();
  _linearAdapter = linear;

  const bot = new Chat({
    userName: "foreman",
    adapters: { linear },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = await getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    linearUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser(
      "linear",
      linearUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from Linear, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 5,
      memory: {
        thread: `linear-${threadId}`,
        resource: userId,
      },
    });
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // Linear interactions come as mentions in issues/comments
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[linear] DM from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[linear] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[linear] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[linear] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[linear] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[linear] Mention handler error:", err);
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
        message.author.fullName
      );
      await thread.post(reply);
    } catch (err) {
      console.error("[linear] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying Linear adapter instance.
 */
export function getLinearAdapter() {
  if (!_linearAdapter) getLinearBot();
  return _linearAdapter!;
}
