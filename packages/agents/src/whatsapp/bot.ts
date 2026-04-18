import { Chat } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ whatsapp: ReturnType<typeof createWhatsAppAdapter> }> | undefined;
let _whatsappAdapter: ReturnType<typeof createWhatsAppAdapter> | undefined;

/**
 * Create and configure the WhatsApp bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the WhatsApp adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export function getWhatsAppBot() {
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
    const userId = await registerChannelUser(
      "whatsapp",
      whatsappUserId,
      displayName
    );

    const result = await agent.generate(text, {
      memory: {
        thread: `whatsapp-${threadId}`,
        resource: userId,
      },
    });
    return result.text;
  }

  // WhatsApp is primarily DM-based
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[whatsapp] Message from", message.author.userId, ":", message.text);
      const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
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
      console.log("[whatsapp] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
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
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
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
