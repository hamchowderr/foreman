import type { Context } from "hono";
import { getDiscordBot } from "./bot";

/**
 * Handle incoming Discord webhook POST requests.
 * Delegates to the Chat SDK's built-in webhook handler which
 * verifies the public key and dispatches to registered handlers.
 */
export async function handleDiscordWebhook(c: Context): Promise<Response> {
  const bot = getDiscordBot();
  return bot.webhooks.discord(c.req.raw);
}
