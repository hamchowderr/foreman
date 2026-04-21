import { Hono } from "hono";
import {
  consumeConnectToken,
  buildAuthorizeUrl,
  exchangeCodeAndStore,
} from "@/lib/zapier/connect";

/**
 * Zapier OAuth connect routes for non-web channels.
 *
 * Flow:
 * 1. Agent generates a one-time URL: /zapier/connect/:token
 * 2. User opens URL in browser → redirected to Zapier OAuth
 * 3. Zapier redirects back to /zapier/callback with code + state
 * 4. We exchange code for tokens and store them
 */
const zapierConnect = new Hono();

// In-memory state → userId mapping for the OAuth round-trip
const stateMap = new Map<string, { userId: string; expiresAt: number }>();

// Clean expired state entries
setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of stateMap) {
    if (entry.expiresAt < now) stateMap.delete(state);
  }
}, 60_000);

/**
 * Step 1: User clicks the one-time connect link.
 * Validates the token, stores state→userId mapping, redirects to Zapier.
 */
zapierConnect.get("/connect/:token", async (c) => {
  const token = c.req.param("token");
  const pending = consumeConnectToken(token);

  if (!pending) {
    return c.html(
      `<html><body><h1>Link Expired</h1><p>This connect link has expired or has already been used. Please request a new one from the bot.</p></body></html>`,
      400
    );
  }

  // Store state → userId for the callback
  stateMap.set(pending.state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min for OAuth round-trip
  });

  const authorizeUrl = buildAuthorizeUrl(pending.state);
  return c.redirect(authorizeUrl);
});

/**
 * Step 2: Zapier redirects back here after user authorizes.
 */
zapierConnect.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.html(
      `<html><body><h1>Connection Failed</h1><p>Zapier returned an error: ${escapeHtml(error)}</p><p>Please try again from the bot.</p></body></html>`,
      400
    );
  }

  if (!code || !state) {
    return c.html(
      `<html><body><h1>Invalid Request</h1><p>Missing authorization code or state parameter.</p></body></html>`,
      400
    );
  }

  // Look up userId from state
  const stateEntry = stateMap.get(state);
  if (!stateEntry || stateEntry.expiresAt < Date.now()) {
    stateMap.delete(state!);
    return c.html(
      `<html><body><h1>Session Expired</h1><p>The authorization session has expired. Please request a new connect link from the bot.</p></body></html>`,
      400
    );
  }
  stateMap.delete(state);

  try {
    await exchangeCodeAndStore(code, stateEntry.userId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return c.html(
      `<html><body><h1>Connection Failed</h1><p>Could not complete the Zapier connection: ${escapeHtml(message)}</p><p>Please try again from the bot.</p></body></html>`,
      500
    );
  }

  return c.html(
    `<html><body style="font-family:system-ui;text-align:center;padding:4rem"><h1>Connected!</h1><p>Your Zapier account is now linked to Foreman. You can close this window and return to the bot.</p></body></html>`
  );
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default zapierConnect;
