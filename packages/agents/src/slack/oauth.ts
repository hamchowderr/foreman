import type { Context } from "hono";
import { getSlackAdapter } from "./bot";
import { getSupabase } from "../lib/db";
import { encryptToken } from "../lib/crypto";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

export async function handleSlackOAuth(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return c.redirect(
      `${WEB_URL}/settings/integrations/slack?error=${encodeURIComponent(error ?? "missing_code")}`,
      302
    );
  }

  try {
    const adapter = getSlackAdapter();
    const { teamId, installation } = await adapter.handleOAuthCallback(c.req.raw);

    // Persist encrypted bot token to Supabase so it survives restarts
    const db = getSupabase();
    await db.from("slack_installation").upsert(
      {
        team_id: teamId,
        team_name: installation.teamName ?? null,
        bot_token: encryptToken(installation.botToken),
        bot_user_id: installation.botUserId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );

    return c.redirect(
      `${WEB_URL}/settings/integrations/slack?connected=1`,
      302
    );
  } catch (err) {
    console.error("[slack/oauth] Error:", err);
    return c.redirect(
      `${WEB_URL}/settings/integrations/slack?error=oauth_failed`,
      302
    );
  }
}

