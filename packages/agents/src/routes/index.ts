import { Hono } from "hono";
import conversations from "./conversations";
import proposals from "./proposals";
import workflows from "./workflows";
import zapierConnect from "./zapier-connect";
import webhooks from "./webhooks";
import capabilities from "./capabilities";
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
app.route("/conversations", conversations);
app.route("/proposals", proposals);
app.route("/workflows", workflows);
app.route("/zapier", zapierConnect);
app.route("/webhooks", webhooks);
app.route("/capabilities", capabilities);
app.post("/telegram/webhook", handleTelegramWebhook);
app.post("/slack/webhook", handleSlackWebhook);
app.post("/discord/webhook", handleDiscordWebhook);

export default app;
