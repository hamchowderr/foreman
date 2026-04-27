import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import {
  consumeConnectToken,
  buildAuthorizeUrl,
  exchangeCodeAndStore,
} from "@/lib/zapier/connect";
import { resolveFromSupabaseJwt } from "@/lib/identity";
import { getSupabase } from "@/lib/db";

const zapierConnect = new Hono();

// In-memory state → userId mapping for the OAuth round-trip
const stateMap = new Map<string, { userId: string; expiresAt: number; isWeb?: boolean }>();

// Clean expired state entries
setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of stateMap) {
    if (entry.expiresAt < now) stateMap.delete(state);
  }
}, 60_000);

/**
 * Web OAuth initiation — called from the onboarding flow.
 * Reads the Supabase JWT from Authorization header, generates OAuth state,
 * and returns the Zapier authorize URL for the browser to redirect to.
 */
zapierConnect.get("/web-connect", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const identity = await resolveFromSupabaseJwt(authHeader.slice(7));
  if (!identity) return c.json({ error: "Unauthorized" }, 401);

  const state = randomBytes(16).toString("hex");
  stateMap.set(state, {
    userId: identity.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    isWeb: true,
  });

  const authorizeUrl = buildAuthorizeUrl(state);
  return c.json({ authorizeUrl });
});

/**
 * Check if the current user has a connected Zapier account.
 */
zapierConnect.get("/status", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const identity = await resolveFromSupabaseJwt(authHeader.slice(7));
  if (!identity) return c.json({ error: "Unauthorized" }, 401);

  const supabase = getSupabase();
  const { data } = await supabase
    .from("zapier_identity")
    .select("id")
    .eq("user_id", identity.userId)
    .maybeSingle();

  return c.json({ connected: !!data });
});

/**
 * Bot channel connect — agent generates a one-time URL: /zapier/connect/:token
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

  stateMap.set(pending.state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const authorizeUrl = buildAuthorizeUrl(pending.state);
  return c.redirect(authorizeUrl);
});

/**
 * Zapier OAuth callback — handles both web onboarding and bot channel flows.
 */
zapierConnect.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.html(
      `<html><body><h1>Connection Failed</h1><p>Zapier returned an error: ${escapeHtml(error)}</p><p>Please try again.</p></body></html>`,
      400
    );
  }

  if (!code || !state) {
    return c.html(
      `<html><body><h1>Invalid Request</h1><p>Missing authorization code or state parameter.</p></body></html>`,
      400
    );
  }

  const stateEntry = stateMap.get(state);
  if (!stateEntry || stateEntry.expiresAt < Date.now()) {
    stateMap.delete(state!);
    return c.html(
      `<html><body><h1>Session Expired</h1><p>The authorization session has expired. Please try connecting again.</p></body></html>`,
      400
    );
  }
  stateMap.delete(state);

  try {
    await exchangeCodeAndStore(code, stateEntry.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.html(
      `<html><body><h1>Connection Failed</h1><p>Could not complete the Zapier connection: ${escapeHtml(message)}</p></body></html>`,
      500
    );
  }

  // Web onboarding flow — redirect back to the onboarding page
  if (stateEntry.isWeb) {
    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    return c.redirect(`${webUrl}/onboarding?step=2&zapier_connected=true`);
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
