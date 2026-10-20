import type { Context } from "hono";
import { getForemanAgentControllerInstance } from "../mastra/lib/agent-controller";
import type { ChannelPlatform } from "./controller-channels";

/**
 * The pre-controller webhook paths (`/slack/webhook`, `/discord/webhook`,
 * `/telegram/webhook`), kept so the URLs already registered with Slack, Discord
 * and Telegram keep working. Each forwards to the controller channels, the same
 * handler behind Mastra's generated
 * `/api/agent-controllers/foreman-agent-controller/channels/<platform>/webhook`.
 */
export function forwardChannelWebhook(platform: ChannelPlatform) {
  return async (c: Context): Promise<Response> => {
    // Read the body once and rebuild the request: signature checks need the exact bytes.
    const body = await c.req.arrayBuffer();

    // Slack's URL check gets a 3-second deadline; answer it before waiting on
    // channel initialization (DB reads for workspace installs).
    if (platform === "slack") {
      try {
        const payload = JSON.parse(new TextDecoder().decode(body));
        if (payload?.type === "url_verification") {
          return c.json({ challenge: payload.challenge });
        }
      } catch {
        // Not JSON (e.g. an interactivity form post); the adapter handles it.
      }
    }

    const channels = getForemanAgentControllerInstance().getChannels();
    if (!channels?.hasAdapter(platform)) {
      return c.json({ error: `${platform} is not configured on this server` }, 404);
    }
    return channels.handleWebhookEvent(
      platform,
      new Request(c.req.url, { method: c.req.method, headers: c.req.raw.headers, body }),
    );
  };
}
