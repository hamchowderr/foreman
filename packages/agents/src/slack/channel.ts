import { createSlackAdapter } from "@chat-adapter/slack";
import type { ChannelConfig } from "@mastra/core/channels";
import { redeemChannelLinkCode, registerChannelUser } from "../lib/identity";
import { USER_ID_KEY } from "../lib/request-user-context";
import { rehydrateSlackInstallations } from "./installations";

/**
 * Slack on Mastra's native `Agent.channels` — Phase 1 of foreman-3i9k.
 *
 * Mastra generates `POST /api/agents/foreman/channels/slack/webhook` on the
 * main :4111 server from this config, replacing the hand-built raw-Node webhook
 * server on :4112. Two properties of that generated route were verified in
 * core 1.57.0's source rather than assumed, because both would have been quiet
 * failures: it is declared `requiresAuth: false` (so Slack's unsigned-by-JWT
 * POST is not rejected by Foreman's Supabase middleware), and its handler
 * forwards `c.req.raw` untouched (so Slack's signature verification still sees
 * the original bytes — the exact problem :4112 exists to work around).
 * `/api/agents` is also absent from `CUSTOM_ROUTE_PREFIXES`, so Foreman's own
 * middleware lets it fall through with the body intact.
 *
 * OFF by default and gated on `FOREMAN_NATIVE_CHANNELS`. While the flag is
 * unset this module contributes nothing — no adapter, no route — and the
 * existing bot on `/slack/webhook` is untouched. Turning it on adds a SECOND
 * route that receives nothing until someone repoints Slack's Event
 * Subscription URL at it, which is the Phase 3 cutover. That is what "wire
 * alongside" means here: both paths exist, only one is addressed.
 */

/** Platforms opted into native channels, e.g. `FOREMAN_NATIVE_CHANNELS=slack`. */
export function nativeChannelPlatforms(): Set<string> {
  const raw = process.env.FOREMAN_NATIVE_CHANNELS ?? "";
  return new Set(
    raw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  );
}

const LINK_COMMAND = /^\/?\s*link\s+([A-Z0-9]{8})$/i;

/**
 * Reply to `/link ABCD1234` in a DM, or return false if this wasn't one.
 *
 * Carried over verbatim from `bot.ts` rather than reimplemented: the code
 * pairing flow writes `channel_identity` rows the whole identity layer depends
 * on, and it is the one piece of the Slack surface that must behave identically
 * on both paths while they run side by side.
 */
async function handleLinkCommand(
  thread: { post: (text: string) => Promise<unknown> },
  message: { text?: string; author: { userId: string; fullName?: string } },
): Promise<boolean> {
  const code = message.text?.trim().match(LINK_COMMAND)?.[1];
  if (!code) return false;

  const result = await redeemChannelLinkCode(
    code,
    "slack",
    message.author.userId,
    message.author.fullName,
  );
  if (result.ok) {
    await thread.post(
      "Your Slack account is now linked to Foreman. You can close the settings page.",
    );
  } else if (result.error === "expired") {
    await thread.post("That code has expired. Generate a new one from your Foreman settings.");
  } else if (result.error === "already_used") {
    await thread.post("That code has already been used. Generate a new one if needed.");
  } else {
    await thread.post("Code not found. Check you copied it correctly, or generate a new one.");
  }
  return true;
}

/**
 * Map the Slack sender to their Foreman user and stamp it on the run.
 *
 * This is the whole reason Phase 0b came first. Mastra invokes the agent from
 * its own route, so the AsyncLocalStorage scope every custom bot establishes is
 * absent — without this stamp every Zapier tool would fall back to the global
 * client-credentials SDK and execute as the WRONG account, silently. The stamp
 * has to happen BEFORE `defaultHandler`, which is exactly what
 * `ChannelHandlerContext.requestContext` is documented for.
 */
async function stampActingUser(
  message: { author: { userId: string; fullName?: string } },
  ctx: { requestContext: { set: (key: string, value: unknown) => void } },
): Promise<void> {
  const userId = await registerChannelUser("slack", message.author.userId, message.author.fullName);
  ctx.requestContext.set(USER_ID_KEY, userId);
}

/**
 * The native Slack channel config, or `undefined` when the flag is off — in
 * which case the agent gets no `channels` at all and Mastra generates no route.
 */
export function buildSlackChannelConfig(): ChannelConfig | undefined {
  if (!nativeChannelPlatforms().has("slack")) return undefined;

  const slack = createSlackAdapter();

  // Multi-workspace installs must be loaded into the adapter before it can
  // route an event to the right team, and `setInstallation` needs the state
  // store that `initialize(chat)` wires up — so ordering matters and there is
  // no post-init hook on ChannelConfig. Decorating the adapter's own
  // `initialize` is the seam: it preserves the initialize-then-rehydrate order
  // `bot.ts` already relies on, without an external caller that could be
  // forgotten. One adapter holds many workspaces (`setInstallation(teamId,…)`,
  // per-team state keys) — the "one bot identity" wording in the Mastra docs
  // describes the bot, not a single-tenant limit.
  const initialize = slack.initialize.bind(slack);
  slack.initialize = async (chat) => {
    await initialize(chat);
    await rehydrateSlackInstallations(slack);
  };

  return {
    adapters: { slack },
    userName: "foreman",

    // Memory ownership: the unified Foreman user id, NOT the native default of
    // `slack:U123`. Cross-channel recall is the point — what someone said on
    // Discord has to be reachable when they message from Slack, and that only
    // holds while every channel resolves to the same resource. Runs on new
    // threads only, so it never relocates an existing conversation's memory.
    resolveResourceId: ({ message, defaultResourceId }) =>
      registerChannelUser("slack", message.author.userId, message.author.fullName).catch(
        // A failed lookup must not hand the thread to the wrong owner; fall
        // back to the platform-scoped default, which is isolated by construction.
        () => defaultResourceId,
      ),

    handlers: {
      onDirectMessage: async (thread, message, defaultHandler, ctx) => {
        if (!message.text) return;
        if (await handleLinkCommand(thread, message)) return;
        await stampActingUser(message, ctx);
        await defaultHandler(thread, message);
      },
      onMention: async (thread, message, defaultHandler, ctx) => {
        if (!message.text) return;
        await stampActingUser(message, ctx);
        await defaultHandler(thread, message);
      },
      onSubscribedMessage: async (thread, message, defaultHandler, ctx) => {
        if (!message.text) return;
        await stampActingUser(message, ctx);
        await defaultHandler(thread, message);
      },
    },
  };
}
