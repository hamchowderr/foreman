import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleDiscordWebhook } from "../discord/webhook";
import { handleSlackOAuth } from "../slack/oauth";
import { handleSlackWebhook } from "../slack/webhook";
import { handleTelegramWebhook } from "../telegram/webhook";
import apiKeys from "./api-keys";
import capabilities from "./capabilities";
import channelLinks from "./channel-links";
import conversations from "./conversations";
import dashboards from "./dashboards";
import guardrails from "./guardrails";
import proposals from "./proposals";
import storedAgents from "./stored-agents";
import voice from "./voice";
import webhooks from "./webhooks";
import workflows from "./workflows";
import zapierConnect, { handleOAuthCallback } from "./zapier-connect";

/**
 * Custom Hono app that handles Foreman API routes.
 * Mounted as Mastra server middleware so it coexists with
 * Mastra's built-in /api routes (agents, memory, etc.).
 *
 * Our routes live under /conversations, /proposals, /zapier, /webhooks,
 * /telegram, /slack, and /discord (not /api/* which is reserved by Mastra).
 */
const app = new Hono();

// CORS for web frontend direct access
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "https://foreman.otakusolutions.io"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.route("/conversations", conversations);
app.route("/proposals", proposals);
app.route("/workflows", workflows);
app.route("/dashboards", dashboards);
app.route("/stored/agents", storedAgents);
app.route("/zapier", zapierConnect);
app.get("/oauth", handleOAuthCallback);
app.route("/webhooks", webhooks);
app.route("/capabilities", capabilities);
app.route("/guardrails", guardrails);
app.route("/voice", voice);
app.route("/api-keys", apiKeys);
app.route("/channel-links", channelLinks);
app.post("/telegram/webhook", handleTelegramWebhook);
app.post("/slack/webhook", handleSlackWebhook);
app.get("/slack/oauth", handleSlackOAuth);
app.post("/discord/webhook", handleDiscordWebhook);

export default app;
