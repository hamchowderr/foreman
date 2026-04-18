import type { Context } from "hono";
import { getSlackBot } from "./bot";

/**
 * Handle incoming Slack webhook POST requests.
 * Delegates to the Chat SDK's built-in webhook handler which
 * verifies the signing secret and dispatches to registered handlers.
 */
export async function handleSlackWebhook(c: Context): Promise<Response> {
  const bot = getSlackBot();
  return bot.webhooks.slack(c.req.raw);
}
