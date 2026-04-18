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

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from Discord, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 10,
      memory: {
        thread: `discord-${threadId}`,
        resource: userId,
      },
      onStepFinish: (step: any) => {
        try {
          if (step.toolCalls?.length) {
            for (const tc of step.toolCalls) {
              const name = tc?.toolName ?? tc?.name ?? "unknown";
              const args = tc?.args ? JSON.stringify(tc.args).substring(0, 150) : "{}";
              console.log(`[discord] Tool: ${name}(${args})`);
            }
          }
          if (step.text) console.log(`[discord] Step text: ${step.text.substring(0, 80)}`);
        } catch {
          // Don't let logging errors crash the agent
        }
      },
    });
    return result.text || "I completed the tool calls but couldn't generate a final response. Please try again.";
  }

  // Handle DMs
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

  // Handle @-mentions in channels
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    await thread.subscribe();
    await thread.startTyping().catch(() => {});
    try {
      console.log("[discord] Generating reply for:", message.text.substring(0, 80));
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[discord] Reply generated:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[discord] Error in onNewMention:", err);
      await thread.post("Sorry, I encountered an error processing your request. Please try again.");
    }
  });

  // Handle follow-up messages in threads the bot is subscribed to
  bot.onSubscribedMessage(async (thread, message) => {
    if (!message.text) return;
    await thread.startTyping().catch(() => {});
    try {
      console.log("[discord] Subscribed msg:", message.text.substring(0, 80));
      const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[discord] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[discord] Error in onSubscribedMessage:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
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
