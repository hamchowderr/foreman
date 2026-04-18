import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ slack: ReturnType<typeof createSlackAdapter> }> | undefined;
let _slackAdapter: ReturnType<typeof createSlackAdapter> | undefined;

/**
 * Create and configure the Slack bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Slack adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export function getSlackBot() {
  if (_bot) return _bot;

  const slack = createSlackAdapter();
  _slackAdapter = slack;

  const bot = new Chat({
    userName: "foreman",
    adapters: { slack },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    slackUserId: string,
    text: string,
    displayName?: string,
  ) {
    // Auto-register Slack user → Foreman user (idempotent)
    const userId = await registerChannelUser(
      "slack",
      slackUserId,
      displayName
    );

    const result = await agent.generate(text, {
      memory: {
        thread: `slack-${threadId}`,
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
 * Return the underlying Slack adapter instance.
 */
export function getSlackAdapter() {
  if (!_slackAdapter) getSlackBot();
  return _slackAdapter!;
}
