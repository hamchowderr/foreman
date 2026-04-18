import { Hono } from "hono";
import conversations from "./conversations";
import proposals from "./proposals";
import { handleTelegramWebhook } from "../telegram/webhook";

/**
 * Custom Hono app that handles Foreman API routes.
 * Mounted as Mastra server middleware so it coexists with
 * Mastra's built-in /api routes (agents, memory, etc.).
 *
 * Our routes live under /conversations, /proposals, and /telegram
 * (not /api/* which is reserved by Mastra).
 */
const app = new Hono();
app.route("/conversations", conversations);
app.route("/proposals", proposals);
app.post("/telegram/webhook", handleTelegramWebhook);

export default app;
