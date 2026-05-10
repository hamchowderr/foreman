import { createMemoryState } from "@chat-adapter/state-memory";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { stepCountIs } from "ai";
import { Chat } from "chat";
import { registerChannelUser } from "../lib/identity";
import { requestUserContext } from "../lib/request-user-context";
import { getMastra } from "../mastra";
import { matchAndFireChannelTriggers } from "../workflows/channel-trigger";

let _bot: Chat<{ whatsapp: ReturnType<typeof createWhatsAppAdapter> }> | undefined;
let _whatsappAdapter: ReturnType<typeof createWhatsAppAdapter> | undefined;

/**
 * Create and configure the WhatsApp bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the WhatsApp adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export async function getWhatsAppBot() {
  if (_bot) return _bot;

  const whatsapp = createWhatsAppAdapter();
  _whatsappAdapter = whatsapp;

  const bot = new Chat({
    userName: "foreman",
    adapters: { whatsapp },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    whatsappUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser("whatsapp", whatsappUserId, displayName);

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from WhatsApp, because resource is the same userId.
    const result = await requestUserContext.run({ userId }, () =>
      agent.generate(text, {
        stopWhen: stepCountIs(5),
        savePerStep: true,
        memory: {
          thread: `whatsapp-${threadId}`,
          resource: userId,
        },
      }),
    );
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // WhatsApp is primarily DM-based
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      const fired = await matchAndFireChannelTriggers({
        channel: "whatsapp",
        text: message.text,
        from: message.author.userId,
        room: thread.channelId,
      });
      if (fired > 0) return;
      console.log("[whatsapp] Message from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
      const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName,
      );
      console.log("[whatsapp] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[whatsapp] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  // Handle group mentions
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      const fired = await matchAndFireChannelTriggers({
        channel: "whatsapp",
        text: message.text,
        from: message.author.userId,
        room: thread.id,
      });
      if (fired > 0) return;
      console.log("[whatsapp] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName,
      );
      console.log("[whatsapp] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[whatsapp] Mention handler error:", err);
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
      console.error("[whatsapp] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying WhatsApp adapter instance.
 */
export function getWhatsAppAdapter() {
  if (!_whatsappAdapter) getWhatsAppBot();
  return _whatsappAdapter!;
}
