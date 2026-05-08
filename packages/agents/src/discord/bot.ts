import { stepCountIs } from "ai";
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
export async function getDiscordBot() {
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

  async function generateStreamedReply(
    thread: any,
    threadId: string,
    discordUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser(
      "discord",
      discordUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from Discord, because resource is the same userId.
    let postedStepTexts: string[] = [];

    const result = await agent.generate(text, {
      stopWhen: stepCountIs(10),
      savePerStep: true,
      memory: {
        thread: `discord-${threadId}`,
        resource: userId,
      },
      onStepFinish: async (step: any) => {
        try {
          if (step.text && step.finishReason === "tool-calls") {
            await thread.post(step.text);
            postedStepTexts.push(step.text);
          }
        } catch {
          // Don't let posting errors crash the agent
        }
      },
    });

    // result.text contains ALL step texts concatenated.
    // Strip out anything we already posted to avoid duplicates.
    let finalText = result.text || "";
    for (const posted of postedStepTexts) {
      finalText = finalText.replace(posted, "").trim();
    }
    return finalText || (postedStepTexts.length > 0 ? null : "Something went wrong — I couldn't generate a response.");
  }

  // Handle DMs
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    await thread.startTyping().catch(() => {});
    const reply = await generateStreamedReply(
      thread,
      thread.channelId,
      message.author.userId,
      message.text,
      message.author.fullName
    );
    if (reply) await thread.post(reply);
  });

  // Handle @-mentions in channels
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    await thread.subscribe();
    await thread.startTyping().catch(() => {});
    try {
      console.log("[discord] Generating reply for:", message.text.substring(0, 80));
      const reply = await generateStreamedReply(
        thread,
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      if (reply) {
        console.log("[discord] Final reply:", reply.substring(0, 100));
        await thread.post(reply);
      }
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
      const reply = await generateStreamedReply(
        thread,
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      if (reply) {
        console.log("[discord] Reply:", reply.substring(0, 100));
        await thread.post(reply);
      }
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
