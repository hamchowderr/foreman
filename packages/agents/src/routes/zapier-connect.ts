import { Hono } from "hono";
import {
  consumeConnectToken,
  buildAuthorizeUrl,
  exchangeCodeAndStore,
  webConnectStateMap,
} from "@/lib/zapier/connect";
import { resolveFromSupabaseJwt, ensureUserExists } from "@/lib/identity";
import { getSupabase } from "@/lib/db";
import { randomBytes } from "node:crypto";

const zapierConnect = new Hono();

/**
 * Web OAuth initiation — called from the onboarding flow.
 */
zapierConnect.get("/web-connect", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const identity = await resolveFromSupabaseJwt(authHeader.slice(7));
  if (!identity) return c.json({ error: "Unauthorized" }, 401);
  await ensureUserExists(identity.userId);

  const state = randomBytes(16).toString("hex");
  const { authorizeUrl, codeVerifier, redirectUri } = await buildAuthorizeUrl(state);

  webConnectStateMap.set(state, {
    userId: identity.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    isWeb: true,
    codeVerifier,
    redirectUri,
  });

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

  const { authorizeUrl, codeVerifier, redirectUri } = await buildAuthorizeUrl(pending.state);
  webConnectStateMap.set(pending.state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    codeVerifier,
    redirectUri,
  });

  return c.redirect(authorizeUrl);
});

/**
 * Zapier OAuth PKCE callback — Zapier redirects here after user authorizes.
 * Also mounted at root /oauth via routes/index.ts.
 */
async function handleCallback(c: any) {
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

  const stateEntry = webConnectStateMap.get(state);
  if (!stateEntry || stateEntry.expiresAt < Date.now()) {
    webConnectStateMap.delete(state!);
    return c.html(
      `<html><body><h1>Session Expired</h1><p>The authorization session has expired. Please try connecting again.</p></body></html>`,
      400
    );
  }
  webConnectStateMap.delete(state);

  try {
    await exchangeCodeAndStore(code, stateEntry.userId, stateEntry.codeVerifier, stateEntry.redirectUri);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.html(
      `<html><body><h1>Connection Failed</h1><p>Could not complete the Zapier connection: ${escapeHtml(message)}</p></body></html>`,
      500
    );
  }

  if (stateEntry.isWeb) {
    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    return c.redirect(`${webUrl}/onboarding?step=2&zapier_connected=true`);
  }

  return c.html(
    `<html><body style="font-family:system-ui;text-align:center;padding:4rem"><h1>Connected!</h1><p>Your Zapier account is now linked to Foreman. You can close this window and return to the bot.</p></body></html>`
  );
}

zapierConnect.get("/callback", handleCallback);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { handleCallback as handleOAuthCallback };
export default zapierConnect;
