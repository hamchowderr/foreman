/**
 * Channel-trigger entrypoint. Channel webhook handlers (slack/discord/telegram/
 * etc.) call `matchAndFireChannelTriggers` on every inbound message. The match +
 * fire + dedup logic lives in the ChannelTriggerSignalProvider (a Mastra
 * SignalProvider hosted on the foreman agent); this wrapper keeps the existing
 * call-site signature stable and delegates to it.
 *
 * Match semantics:
 *   - `channel` field MUST equal the inbound channel name.
 *   - `match.command` (optional): exact text match against the message body.
 *     Leading slashes, bangs and surrounding whitespace are tolerated so
 *     "!standup", "/standup", " standup " all match the rule "!standup".
 *   - `match.from` (optional): regex on the sender id/handle.
 *   - `match.room` (optional): exact match on room/channel/DM target.
 *
 * All provided criteria must pass — empty match = matches every message on that
 * channel (rarely what you want, but supported).
 */

import { channelTriggerProvider } from "@/mastra/signals/channel-trigger-provider";

export interface ChannelMessage {
  channel: "slack" | "discord" | "telegram" | "linear" | "github" | "gchat" | "teams" | "whatsapp";
  text: string;
  /** Sender handle/userId — used by `match.from`. */
  from: string;
  /** Channel/room/DM target — used by `match.room`. */
  room?: string;
  /**
   * Stable per-delivery key for idempotency (the platform message id). Every
   * channel bot passes `message.id` (the normalized Chat SDK `Message.id`), so
   * a retried webhook carries the same key and the workflow fires once — while
   * two legitimately-repeated identical messages keep distinct ids and both
   * fire. When omitted, the provider falls back to a content hash (which would
   * coalesce repeated identical text).
   */
  dedupeKey?: string;
}

export async function matchAndFireChannelTriggers(msg: ChannelMessage): Promise<number> {
  return channelTriggerProvider.handleMessage(msg);
}
