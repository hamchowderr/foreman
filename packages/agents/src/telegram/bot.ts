import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ telegram: ReturnType<typeof createTelegramAdapter> }> | undefined;
let _telegramAdapter: ReturnType<typeof createTelegramAdapter> | undefined;

/**
 * Create and configure the Telegram bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Telegram adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export function getTelegramBot() {
  if (_bot) return _bot;

  const telegram = createTelegramAdapter({
    mode: "auto",
  });
  _telegramAdapter = telegram;

  const bot = new Chat({
    userName: "foreman",
    adapters: { telegram },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = await getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    telegramUserId: string,
    text: string,
    displayName?: string,
  ) {
    // Auto-register Telegram user → Foreman user (idempotent)
    const userId = await registerChannelUser(
      "telegram",
      telegramUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Discord
    // is available when they message from Telegram, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 5,
      memory: {
        thread: `telegram-${threadId}`,
        resource: userId,
      },
    });
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // Handle DMs — Telegram bots receive DMs as the primary interaction mode.
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    await thread.startTyping().catch(() => {});
    const reply = await generateReply(
      thread.channelId,
      message.author.userId,
      message.text,
      message.author.fullName
    );
    await thread.post(reply);
  });

  // Handle @-mentions in group chats.
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    await thread.subscribe();
    await thread.startTyping().catch(() => {});
    const reply = await generateReply(
      thread.id,
      message.author.userId,
      message.text,
      message.author.fullName
    );
    await thread.post(reply);
  });

  // Handle follow-up messages in threads the bot is subscribed to.
  bot.onSubscribedMessage(async (thread, message) => {
    if (!message.text) return;
    await thread.startTyping().catch(() => {});
    const reply = await generateReply(
      thread.id,
      message.author.userId,
      message.text,
      message.author.fullName
    );
    await thread.post(reply);
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying Telegram adapter instance.
 * Useful for checking `runtimeMode` or calling `startPolling()`/`stopPolling()`.
 */
export function getTelegramAdapter() {
  if (!_telegramAdapter) getTelegramBot();
  return _telegramAdapter!;
}

/**
 * Start the Telegram bot in polling mode for local development.
 * Calls `bot.initialize()` which triggers the adapter's auto-mode detection
 * and starts long-polling when no webhook URL is configured.
 */
export async function startTelegramPolling() {
  const bot = getTelegramBot();
  await bot.initialize();
  const adapter = getTelegramAdapter();
  console.log(`Telegram bot started in ${adapter.runtimeMode} mode`);
  return bot;
}
