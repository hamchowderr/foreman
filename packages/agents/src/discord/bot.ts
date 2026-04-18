import { Chat } from "chat";
import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ discord: ReturnType<typeof createDiscordAdapter> }> | undefined;
let _discordAdapter: ReturnType<typeof createDiscordAdapter> | undefined;

/**
 * Create and configure the Discord bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Discord adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export function getDiscordBot() {
  if (_bot) return _bot;

  const discord = createDiscordAdapter();
  _discordAdapter = discord;

  const bot = new Chat({
    userName: "foreman",
    adapters: { discord },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    discordUserId: string,
    text: string,
    displayName?: string,
  ) {
    // Auto-register Discord user → Foreman user (idempotent)
    const userId = await registerChannelUser(
      "discord",
      discordUserId,
      displayName
    );

    const result = await agent.generate(text, {
      memory: {
        thread: `discord-${threadId}`,
        resource: userId,
      },
    });
    return result.text;
  }

  // Handle DMs
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    const reply = await generateReply(
      thread.channelId,
      message.author.userId,
      message.text,
      message.author.name
    );
    await thread.post(reply);
  });

  // Handle @-mentions in channels
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    await thread.subscribe();
    const reply = await generateReply(
      thread.id,
      message.author.userId,
      message.text,
      message.author.name
    );
    await thread.post(reply);
  });

  // Handle follow-up messages in threads the bot is subscribed to
  bot.onSubscribedMessage(async (thread, message) => {
    if (!message.text) return;
    const reply = await generateReply(
      thread.id,
      message.author.userId,
      message.text,
      message.author.name
    );
    await thread.post(reply);
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying Discord adapter instance.
 */
export function getDiscordAdapter() {
  if (!_discordAdapter) getDiscordBot();
  return _discordAdapter!;
}
