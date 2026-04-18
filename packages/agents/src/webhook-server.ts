import http from "node:http";
import { getSlackBot } from "./slack/bot";
import { getTelegramBot } from "./telegram/bot";
import { getTeamsBot } from "./teams/bot";
import { getGoogleChatBot } from "./gchat/bot";
import { getWhatsAppBot } from "./whatsapp/bot";
import { getGitHubBot } from "./github/bot";
import { getLinearBot } from "./linear/bot";
import { getiMessageBot } from "./imessage/bot";
import { getDiscordBot, getDiscordAdapter } from "./discord/bot";

/**
 * Standalone webhook server using raw Node.js HTTP.
 * Hono and @hono/node-server consume the request body stream
 * before the Chat SDK can read it for signature verification.
 * This server passes a fresh Request object with the raw body intact.
 */

const port = Number(process.env.WEBHOOK_PORT) || 4112;

const server = http.createServer(async (req, res) => {
  // Collect the raw body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks);

  const url = `http://localhost:${port}${req.url}`;
  const path = req.url || "/";

  try {
    if (path === "/slack/webhook" && req.method === "POST") {
      const bot = getSlackBot();
      // Build a fresh Web API Request with the exact raw body bytes
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.slack(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/telegram/webhook" && req.method === "POST") {
      const bot = getTelegramBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.telegram(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/teams/webhook" && req.method === "POST") {
      const bot = getTeamsBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.teams(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/gchat/webhook" && req.method === "POST") {
      const bot = getGoogleChatBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.gchat(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/whatsapp/webhook" && (req.method === "POST" || req.method === "GET")) {
      const bot = getWhatsAppBot();
      const request = new Request(url, {
        method: req.method!,
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        ...(req.method === "POST" ? { body: rawBody } : {}),
      });
      const response = await bot.webhooks.whatsapp(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/github/webhook" && req.method === "POST") {
      const bot = getGitHubBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.github(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/linear/webhook" && req.method === "POST") {
      const bot = getLinearBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.linear(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/discord/webhook" && req.method === "POST") {
      const bot = getDiscordBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.discord(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/imessage/webhook" && req.method === "POST") {
      const bot = getiMessageBot();
      const request = new Request(url, {
        method: "POST",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body: rawBody,
      });
      const response = await bot.webhooks.imessage(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      return;
    }

    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error("[webhook-server] Error:", err);
    res.writeHead(500);
    res.end("Internal error");
  }
});

server.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);

  // Initialize Discord bot — start Gateway WebSocket for receiving messages
  if (process.env.DISCORD_BOT_TOKEN) {
    (async () => {
    try {
      const bot = getDiscordBot();
      const adapter = getDiscordAdapter();
      // Must initialize Chat instance before starting Gateway
      await bot.initialize();
      // Start Gateway listener in legacy mode (direct processing, no webhook forwarding)
      adapter
        .startGatewayListener(
          { waitUntil: (p: Promise<unknown>) => { p.catch((err: unknown) => console.error("Discord Gateway error:", err)); } },
          24 * 60 * 60 * 1000 // 24 hours
        )
        .then(() => console.log("Discord Gateway listener started"))
        .catch((err: unknown) => console.error("Discord Gateway startup error:", err));
      console.log("Discord bot initialized");
    } catch (err) {
      console.error("Failed to initialize Discord bot:", err);
    }
    })();
  }
});
