import type { Context } from "hono";
import { getSlackBot } from "./bot";

/**
 * Handle incoming Slack webhook POST requests.
 * Passes the raw request directly to Chat SDK — it handles
 * url_verification challenges and signature verification internally.
 */
export async function handleSlackWebhook(c: Context): Promise<Response> {
  // Buffer the body before Hono's stream gets consumed
  const body = await c.req.arrayBuffer();

  // Handle URL verification immediately — don't wait for bot initialization
  // (Slack has a 3-second timeout; bot init includes DB queries)
  try {
    const payload = JSON.parse(new TextDecoder().decode(body));
    if (payload.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {}

  const bot = await getSlackBot();
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });
  return bot.webhooks.slack(request);
}
