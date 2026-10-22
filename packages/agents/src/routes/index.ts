import { Hono } from "hono";
import { cors } from "hono/cors";
import { forwardChannelWebhook } from "../channels/legacy-webhooks";
import { handleSlackOAuth } from "../slack/oauth";
import apiKeys from "./api-keys";
import apps from "./apps";
import automations from "./automations";
import capabilities from "./capabilities";
import channelLinks from "./channel-links";
import chatShares from "./chat-shares";
import documents from "./documents";
import guardrails from "./guardrails";
import proposals from "./proposals";
import storedAgents from "./stored-agents";
import voice from "./voice";
import workspaces from "./workspaces";
import zapierConnect, { handleOAuthCallback } from "./zapier-connect";

/**
 * Custom Hono app that handles Foreman API routes.
 * Mounted as Mastra server middleware so it coexists with
 * Mastra's built-in /api routes (agents, memory, etc.).
 *
 * Our routes live under /proposals, /zapier,
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
app.route("/proposals", proposals);
app.route("/apps", apps);
app.route("/documents", documents);
app.route("/stored/agents", storedAgents);
app.route("/zapier", zapierConnect);
app.get("/oauth", handleOAuthCallback);
app.route("/capabilities", capabilities);
app.route("/guardrails", guardrails);
app.route("/voice", voice);
app.route("/api-keys", apiKeys);
app.route("/channel-links", channelLinks);
app.route("/workspaces", workspaces);
app.route("/automations", automations);
app.route("/chat-shares", chatShares);
// Channel webhooks now land on the AgentController's channels (channels/).
app.post("/telegram/webhook", forwardChannelWebhook("telegram"));
app.post("/slack/webhook", forwardChannelWebhook("slack"));
app.get("/slack/oauth", handleSlackOAuth);
app.post("/discord/webhook", forwardChannelWebhook("discord"));

export default app;
