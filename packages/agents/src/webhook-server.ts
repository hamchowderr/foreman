import http from "node:http";
import { getSlackBot } from "./slack/bot";
import { getTelegramBot } from "./telegram/bot";

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
});
