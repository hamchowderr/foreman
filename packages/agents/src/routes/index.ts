import { Hono } from "hono";
import conversations from "./conversations";
import proposals from "./proposals";

/**
 * Custom Hono app that handles Foreman API routes.
 * Mounted as Mastra server middleware so it coexists with
 * Mastra's built-in /api routes (agents, memory, etc.).
 *
 * Our routes live under /conversations and /proposals
 * (not /api/* which is reserved by Mastra).
 */
const app = new Hono();
app.route("/conversations", conversations);
app.route("/proposals", proposals);

export default app;
