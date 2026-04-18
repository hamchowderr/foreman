import type { Context } from "hono";
import { getSlackBot } from "./bot";

/**
 * Handle incoming Slack webhook POST requests.
 * Passes the raw request directly to Chat SDK — it handles
 * url_verification challenges and signature verification internally.
 */
export async function handleSlackWebhook(c: Context): Promise<Response> {
  const bot = getSlackBot();
  return bot.webhooks.slack(c.req.raw);
}
