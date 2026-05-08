import { Hono } from "hono";
import { cors } from "hono/cors";
import conversations from "./conversations";
import proposals from "./proposals";
import workflows from "./workflows";
import zapierConnect from "./zapier-connect";
import webhooks from "./webhooks";
import capabilities from "./capabilities";
import guardrails from "./guardrails";
import voice from "./voice";
import storedAgents from "./stored-agents";
import { handleTelegramWebhook } from "../telegram/webhook";
import { handleSlackWebhook } from "../slack/webhook";
import { handleDiscordWebhook } from "../discord/webhook";

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
app.use("/*", cors({
  origin: ["http://localhost:3000", "https://foreman.otakusolutions.io"],
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));
app.route("/conversations", conversations);
app.route("/proposals", proposals);
app.route("/workflows", workflows);
app.route("/stored/agents", storedAgents);
app.route("/zapier", zapierConnect);
app.route("/webhooks", webhooks);
app.route("/capabilities", capabilities);
app.route("/guardrails", guardrails);
app.route("/voice", voice);
app.post("/telegram/webhook", handleTelegramWebhook);
app.post("/slack/webhook", handleSlackWebhook);
app.post("/discord/webhook", handleDiscordWebhook);

export default app;
