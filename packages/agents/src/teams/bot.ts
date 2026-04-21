import { Chat } from "chat";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ teams: ReturnType<typeof createTeamsAdapter> }> | undefined;
let _teamsAdapter: ReturnType<typeof createTeamsAdapter> | undefined;

/**
 * Create and configure the Microsoft Teams bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Teams adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export async function getTeamsBot() {
  if (_bot) return _bot;

  const teams = createTeamsAdapter({ appType: "singleTenant" });
  _teamsAdapter = teams;

  const bot = new Chat({
    userName: "foreman",
    adapters: { teams },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    teamsUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser(
      "teams",
      teamsUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from Teams, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 5,
      savePerStep: true,
      memory: {
        thread: `teams-${threadId}`,
        resource: userId,
      },
    });
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[teams] DM from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[teams] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[teams] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[teams] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[teams] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[teams] Mention handler error:", err);
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
      console.error("[teams] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying Teams adapter instance.
 */
export function getTeamsAdapter() {
  if (!_teamsAdapter) getTeamsBot();
  return _teamsAdapter!;
}
