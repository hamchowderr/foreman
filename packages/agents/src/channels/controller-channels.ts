import { createDiscordAdapter } from "@chat-adapter/discord";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import type { Session } from "@mastra/core/agent-controller";
import type {
  AgentControllerChannelsConfig,
  ChannelAdapterConfig,
  ChannelHandler,
  ChannelHandlerContext,
} from "@mastra/core/channels";
import { registerChannelUser, resolveActiveWorkspace, resolveFromChannel } from "../lib/identity";
import { resolveRequestUserId, USER_ID_KEY } from "../lib/request-user-context";
import { AUTO_ALLOWED_TOOLS } from "../mastra/lib/tool-categories";
import { rehydrateSlackInstallations } from "../slack/installations";
import { redeemLinkCodeAndRelink } from "./relink";

/**
 * Slack, Discord and Telegram on the Foreman AgentController (the same engine the
 * web chat runs on), so a channel conversation gets what the web chat gets: tool
 * approvals as Approve/Deny buttons, schedules, subagents, plan mode and ask_user.
 *
 * Mastra generates one webhook route per platform on the main server:
 *   POST /api/agent-controllers/foreman-agent-controller/channels/<platform>/webhook
 * (routes/index.ts also forwards the older /slack|/discord|/telegram/webhook paths
 * here). Discord's Gateway socket and Telegram's dev-time polling start with the
 * controller, and the Chat SDK state (subscriptions, dedupe) lives in Postgres.
 *
 * Who a channel run acts as:
 *  - Memory: every channel thread is owned by the sender's Foreman user id
 *    (`resolveResourceId`), so working memory, OM and recall are shared with the web
 *    chat and the other channels.
 *  - Session: one controller Session per channel thread (`resolveSession`), scoped so
 *    it never collides with the user's web session.
 *  - Tools: every handler stamps the sender's user id and workspace on the run's
 *    RequestContext before dispatch, which is where Zapier tools and the workspace
 *    read the acting user from.
 *  - Ownership: only the thread's owner can talk to its session or answer its
 *    approval cards. Anyone else in a shared Slack/Discord thread is told to start
 *    their own thread, rather than acting with someone else's apps and memory.
 */

/** Platforms Foreman serves through controller channels. */
export const CHANNEL_PLATFORMS = ["slack", "discord", "telegram"] as const;
export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];

/** RequestContext key for the workspace a run acts in (read by the workspace builder). */
const WORKSPACE_ID_KEY = "workspaceId";
/** RequestContext key carrying the chat thread, so a refusal can be explained in it. */
const CHAT_THREAD_KEY = "foremanChatThread";

const LINK_COMMAND = /^\/?\s*link\s+([A-Z0-9]{8})$/i;

const NOT_OWNER_NOTICE =
  "This conversation belongs to the person who started it, so I can't act on it for you. Mention me in a new thread (or DM me) to start your own.";

const LINK_REPLIES = {
  ok: "Your account is now linked to Foreman. You can close the settings page and keep talking to me here.",
  expired: "That code has expired. Generate a new one from your Foreman settings.",
  already_used: "That code has already been used. Generate a new one if needed.",
  wrong_channel:
    "That code was made for a different app. Generate one for this app from your Foreman settings.",
  not_found: "Code not found. Check you copied it correctly, or generate a new one.",
} as const;

let hostChannels = true;

/**
 * Keep this process from hosting the channels. The side processes that construct
 * Mastra (the :4112 webhook server, the inbox worker) call this first: hosting is
 * not idempotent across processes, since each would open its own Discord Gateway
 * socket and Telegram poller and answer every message twice.
 */
export function skipControllerChannels(): void {
  hostChannels = false;
}

/** The session id and registry scope for one channel thread's session. */
export function channelSessionKey(threadId: string): string {
  return `channel:${threadId}`;
}

function friendlyError(error: Error): string {
  console.error("[channels] run failed:", error);
  return "Sorry, something went wrong on my side. Please try again.";
}

let slackAdapter: ReturnType<typeof createSlackAdapter> | undefined;

/**
 * The live Slack adapter, when Slack is configured in this process. The OAuth
 * callback hands new workspace installs to it so they answer without a restart.
 */
export function getSlackChannelAdapter(): ReturnType<typeof createSlackAdapter> | undefined {
  return slackAdapter;
}

/**
 * Build one platform's adapter, or skip it. A platform with missing or broken
 * credentials is logged and left out rather than taking the whole server down.
 */
function tryAdapter(platform: ChannelPlatform, build: () => ChannelAdapterConfig) {
  try {
    // The default formatError posts the raw error message into the chat.
    return { formatError: friendlyError, ...build() } as ChannelAdapterConfig;
  } catch (err) {
    console.error(`[channels] ${platform} is configured but its adapter failed to start:`, err);
    return undefined;
  }
}

function buildAdapters(): Partial<Record<ChannelPlatform, ChannelAdapterConfig>> {
  const adapters: Partial<Record<ChannelPlatform, ChannelAdapterConfig>> = {};

  if (process.env.SLACK_SIGNING_SECRET) {
    const slack = tryAdapter("slack", () => {
      const adapter = createSlackAdapter();
      // Stored workspace installs must be loaded after the adapter's initialize()
      // wires its state store (setInstallation writes there), and the channel config
      // has no post-init hook, so the adapter's own initialize is the seam.
      const initialize = adapter.initialize.bind(adapter);
      adapter.initialize = async (chat) => {
        await initialize(chat);
        await rehydrateSlackInstallations(adapter);
      };
      slackAdapter = adapter;
      return { adapter };
    });
    if (slack) adapters.slack = slack;
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    // Keep core's default "cards" display: on "text" core can't post Approve/Deny
    // buttons and auto-resumes gated tools, so Zapier writes would skip approval.
    const discord = tryAdapter("discord", () => ({ adapter: createDiscordAdapter() }));
    if (discord) adapters.discord = discord;
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    // "auto": webhook mode when a webhook is registered, long-polling otherwise (dev).
    const telegram = tryAdapter("telegram", () => ({
      adapter: createTelegramAdapter({ mode: "auto" }),
    }));
    if (telegram) adapters.telegram = telegram;
  }

  return adapters;
}

/** Stamp the acting Foreman user (and their workspace) on a run's RequestContext. */
async function stampActingUser(
  platform: string,
  author: { userId: string; fullName?: string },
  ctx: Pick<ChannelHandlerContext, "requestContext">,
): Promise<string> {
  const userId = await registerChannelUser(platform, author.userId, author.fullName);
  ctx.requestContext.set(USER_ID_KEY, userId);
  const workspaceId = await resolveActiveWorkspace(userId).catch(() => null);
  if (workspaceId) ctx.requestContext.set(WORKSPACE_ID_KEY, workspaceId);
  return userId;
}

/**
 * Wrap a message handler: ignore empty messages, stamp the sender, then hand off to
 * the controller. A failure before dispatch (identity lookup) gets a plain reply
 * instead of silence.
 */
function messageHandler(options: { handleLink: boolean }): ChannelHandler {
  return async (thread, message, defaultHandler, ctx) => {
    const text = message.text?.trim() ?? "";
    if (!text && !message.attachments?.length) return;
    const platform = thread.adapter.name;

    if (options.handleLink) {
      const code = text.match(LINK_COMMAND)?.[1];
      if (code) {
        // Never reaches the agent: a link code is a credential.
        const result = await redeemLinkCodeAndRelink({
          code,
          platform,
          channelUserId: message.author.userId,
          displayName: message.author.fullName,
          chatThreadId: thread.id,
          mastra: ctx.mastra,
        }).catch((err) => {
          console.error(`[channels] ${platform} /link failed:`, err);
          return null;
        });
        await thread.post(
          result
            ? LINK_REPLIES[result.ok ? "ok" : result.error]
            : "Something went wrong while linking your account. Please try again.",
        );
        return;
      }
    }

    try {
      await stampActingUser(platform, message.author, ctx);
    } catch (err) {
      console.error(`[channels] could not resolve the ${platform} sender:`, err);
      await thread.post("Sorry, I couldn't look up your account. Please try again.");
      return;
    }
    ctx.requestContext.set(CHAT_THREAD_KEY, thread);
    await defaultHandler(thread, message);
  };
}

/**
 * The controller channels config, or `undefined` when no platform is configured
 * (or this process doesn't host channels). `undefined` means the controller gets
 * no `channels`, so Mastra generates no webhook routes and opens no sockets.
 */
export function buildForemanChannels(): AgentControllerChannelsConfig | undefined {
  if (!hostChannels) return undefined;
  const adapters = buildAdapters();
  if (Object.keys(adapters).length === 0) return undefined;

  return {
    adapters,
    userName: "foreman",

    // Memory belongs to the sender's Foreman user, not the native `slack:U123`, so
    // it is shared with the web chat and the other channels. Only runs when a
    // channel thread is first created. No fallback: a guessed owner would hand one
    // person's memory to another, and a platform-scoped one has no apps or workspace.
    resolveResourceId: ({ platform, message }) =>
      registerChannelUser(platform, message.author.userId, message.author.fullName),

    // One session per channel thread, under the owner's resource but in its own
    // registry scope, so it never takes over (or switches the thread of) the user's
    // web session. Also runs on approve/deny clicks, which is where a click from
    // anyone but the owner is refused.
    resolveSession: async ({ controller, thread, requestContext }): Promise<Session> => {
      if (resolveRequestUserId(requestContext) !== thread.resourceId) {
        const chatThread = requestContext?.get(CHAT_THREAD_KEY) as
          | { post: (text: string) => Promise<unknown> }
          | undefined;
        await chatThread?.post(NOT_OWNER_NOTICE).catch(() => {});
        throw new Error("only the thread's owner can use its session");
      }
      const key = channelSessionKey(thread.id);
      const session = await controller.createSession({
        resourceId: thread.resourceId,
        id: key,
        scope: key,
        threadId: thread.id,
        createInitialThread: false,
        requestContext,
      });
      // Same no-card tools as the web session (lib/agent-controller.ts): reads,
      // bookkeeping and the in-app builders. Zapier writes always ask.
      for (const tool of AUTO_ALLOWED_TOOLS) session.grantTool(tool);
      return session;
    },

    handlers: {
      onDirectMessage: messageHandler({ handleLink: true }),
      onMention: messageHandler({ handleLink: false }),
      onSubscribedMessage: messageHandler({ handleLink: false }),
      onSlashCommand: async (event, defaultHandler, ctx) => {
        try {
          await stampActingUser(event.adapter.name, event.user, ctx);
        } catch (err) {
          console.error("[channels] could not resolve the slash-command sender:", err);
          return;
        }
        await defaultHandler();
      },
      // Approve/Deny clicks resume the tool as the clicker, so stamp them the same
      // way; resolveSession then refuses anyone who doesn't own the thread.
      onAction: async (event, defaultHandler, ctx) => {
        const platform = event.adapter.name;
        const userId = await resolveFromChannel(platform, event.user.userId).catch(() => null);
        if (userId) {
          ctx.requestContext.set(USER_ID_KEY, userId);
          const workspaceId = await resolveActiveWorkspace(userId).catch(() => null);
          if (workspaceId) ctx.requestContext.set(WORKSPACE_ID_KEY, workspaceId);
        }
        if (event.thread) ctx.requestContext.set(CHAT_THREAD_KEY, event.thread);
        await defaultHandler();
      },
    },
  };
}
