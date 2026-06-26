import type { Context } from "hono";
import { getTelegramBot } from "./bot";

/**
 * Handle incoming Telegram webhook POST requests.
 * Delegates to the Chat SDK's built-in webhook handler which
 * verifies the secret token and dispatches to registered handlers.
 */
export async function handleTelegramWebhook(c: Context): Promise<Response> {
  const bot = await getTelegramBot();
  return bot.webhooks.telegram(c.req.raw);
}
