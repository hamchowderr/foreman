import { Chat } from "chat";
import { createiMessageAdapter } from "chat-adapter-imessage";
import { createMemoryState } from "@chat-adapter/state-memory";
import { getMastra } from "../mastra";
import { registerChannelUser } from "../lib/identity";

let _bot: Chat<{ imessage: ReturnType<typeof createiMessageAdapter> }> | undefined;
let _imessageAdapter: ReturnType<typeof createiMessageAdapter> | undefined;

/**
 * Create and configure the iMessage bot backed by the Foreman Mastra agent.
 * Uses Chat SDK with the community iMessage adapter. Plain text only — no
 * cards, no streaming. The bot is a singleton — safe to call multiple times.
 */
export async function getiMessageBot() {
  if (_bot) return _bot;

  const isLocal = process.env.IMESSAGE_LOCAL === "true";
  const imessage = createiMessageAdapter({ local: isLocal });
  _imessageAdapter = imessage;

  const bot = new Chat({
    userName: "foreman",
    adapters: { imessage },
    state: createMemoryState(),
    logger: "info",
  });

  const mastra = await getMastra();
  const agent = mastra.getAgent("foreman");

  async function generateReply(
    threadId: string,
    imessageUserId: string,
    text: string,
    displayName?: string,
  ) {
    const userId = await registerChannelUser(
      "imessage",
      imessageUserId,
      displayName
    );

    // Memory: thread = channel-specific conversation, resource = unified user ID.
    // Semantic recall works across channels — what user said on Slack
    // is available when they message from iMessage, because resource is the same userId.
    const result = await agent.generate(text, {
      maxSteps: 5,
      savePerStep: true,
      memory: {
        thread: `imessage-${threadId}`,
        resource: userId,
      },
    });
    return result.text || "Something went wrong — I couldn't generate a response.";
  }

  // iMessage is DM-only
  bot.onDirectMessage(async (thread, message) => {
    if (!message.text) return;
    try {
      console.log("[imessage] Message from", message.author.userId, ":", message.text);
      await thread.startTyping().catch(() => {});
    const reply = await generateReply(
        thread.channelId,
        message.author.userId,
        message.text,
        message.author.fullName
      );
      console.log("[imessage] Reply:", reply?.substring(0, 100));
      await thread.post(reply);
    } catch (err) {
      console.error("[imessage] DM handler error:", err);
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
      console.error("[imessage] Subscribed handler error:", err);
      await thread.post("Sorry, I encountered an error. Please try again.");
    }
  });

  _bot = bot;
  return bot;
}

/**
 * Return the underlying iMessage adapter instance.
 */
export function getiMessageAdapter() {
  if (!_imessageAdapter) getiMessageBot();
  return _imessageAdapter!;
}
