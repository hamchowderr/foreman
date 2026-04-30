import { stepCountIs } from "ai";
import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser, redeemChannelLinkCode } from "../lib/identity";
import { requestUserContext } from "../lib/request-user-context";
import { getSupabase } from "../lib/db";
import { decryptToken } from "../lib/crypto";

let _bot: Chat<{ slack: ReturnType<typeof createSlackAdapter> }> | undefined;
let _slackAdapter: ReturnType<typeof createSlackAdapter> | undefined;

/**
 * Create and configure the Slack bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the Slack adapter. The bot is a singleton — safe to
 * call multiple times.
 */
export async function getSlackBot() {
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

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Discord
    // is available when they message from Slack, because resource is the same userId.
    const result = await requestUserContext.run({ userId }, () => agent.generate(text, {
      stopWhen: stepCountIs(5),
      savePerStep: true,
      memory: {
        thread: `slack-${threadId}`,
        resource: userId,
      },
    }));
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // Handle /link <code> command for account linking (DMs only)
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    const linkMatch = message.text.trim().match(/^\/?link\s+([A-Z0-9]{8})$/i);
    if (linkMatch) {
      const result = await redeemChannelLinkCode(
        linkMatch[1],
        "slack",
        message.author.userId,
        message.author.fullName,
      );
      if (result.ok) {
        await thread.post("Your Slack account is now linked to Foreman. You can close the settings page.");
      } else if (result.error === "expired") {
        await thread.post("That code has expired. Generate a new one from your Foreman settings.");
      } else if (result.error === "already_used") {
        await thread.post("That code has already been used. Generate a new one if needed.");
      } else {
        await thread.post("Code not found. Check you copied it correctly, or generate a new one.");
      }
      return;
    }
  });

  // Handle DMs
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    if (/^\/?link\s+[A-Z0-9]{8}$/i.test(message.text.trim())) return;
    try {
      console.log("[slack] DM from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[slack] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[slack] DM handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  // Handle @-mentions in channels
  bot.onNewMention(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[slack] Mention from", message.author.userId, ":", message.text);
      await thread.subscribe();
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.id,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[slack] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[slack] Mention handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  // Handle follow-up messages in threads the bot is subscribed to
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
      console.error("[slack] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;

  return bot;
}

export async function rehydrateSlackInstallations() {
  if (!_slackAdapter) return;
  await rehydrateInstallations(_slackAdapter);
}

async function rehydrateInstallations(
  adapter: ReturnType<typeof createSlackAdapter>
): Promise<void> {
  const db = getSupabase();
  const { data, error } = await db
    .from("slack_installation")
    .select("team_id, team_name, bot_token, bot_user_id");
  if (error || !data?.length) return;
  for (const row of data) {
    try {
      await adapter.setInstallation(row.team_id, {
        botToken: decryptToken(row.bot_token),
        botUserId: row.bot_user_id ?? undefined,
        teamName: row.team_name ?? undefined,
      });
    } catch (err) {
      console.error("[slack] Failed to rehydrate team", row.team_id, err);
    }
  }
  console.log(`[slack] Rehydrated ${data.length} installation(s) from DB`);
}

/**
 * Return the underlying Slack adapter instance.
 */
export function getSlackAdapter() {
  if (!_slackAdapter) getSlackBot();
  return _slackAdapter!;
}
