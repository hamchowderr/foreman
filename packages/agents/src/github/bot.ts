import { Chat } from "chat";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ github: ReturnType<typeof createGitHubAdapter> }> | undefined;
let _githubAdapter: ReturnType<typeof createGitHubAdapter> | undefined;

/**
 * Create and configure the GitHub bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the GitHub adapter. Comment-based only — no cards/modals.
 * The bot is a singleton — safe to call multiple times.
 */
export function getGitHubBot() {
  if (_bot) return _bot;

  const github = createGitHubAdapter({
    botUserId: process.env.GITHUB_BOT_USER_ID,
  });
  _githubAdapter = github;

  const bot = new Chat({
    userName: "foreman",
    adapters: { github },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    githubUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser(
      "github",
      githubUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from GitHub, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 5,
      memory: {
        thread: `github-${threadId}`,
        resource: userId,
      },
    });
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // GitHub interactions come as mentions in issues/PRs
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[github] DM from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[github] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[github] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[github] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[github] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[github] Mention handler error:", err);
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
      console.error("[github] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying GitHub adapter instance.
 */
export function getGitHubAdapter() {
  if (!_githubAdapter) getGitHubBot();
  return _githubAdapter!;
}
