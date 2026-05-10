import type { Context } from "hono";
import { encryptToken } from "../lib/crypto";
import { getSupabase } from "../lib/db";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;

export async function handleSlackOAuth(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return c.redirect(
      `${WEB_URL}/settings/integrations/slack?error=${encodeURIComponent(error ?? "missing_code")}`,
      302,
    );
  }

  try {
    const redirectUri = `${url.origin}${url.pathname}`;

    // Exchange code for tokens directly via Slack API
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await slackRes.json()) as {
      ok: boolean;
      error?: string;
      team?: { id: string; name: string };
      bot_user_id?: string;
      access_token?: string;
    };

    if (!data.ok || !data.access_token || !data.team?.id) {
      console.error("[slack/oauth] Token exchange failed:", data.error);
      return c.redirect(
        `${WEB_URL}/settings/integrations/slack?error=${encodeURIComponent(data.error ?? "token_exchange_failed")}`,
        302,
      );
    }

    // Persist encrypted bot token to Supabase
    const db = getSupabase();
    await db.from("slack_installation").upsert(
      {
        team_id: data.team.id,
        team_name: data.team.name ?? null,
        bot_token: encryptToken(data.access_token),
        bot_user_id: data.bot_user_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" },
    );

    console.log("[slack/oauth] Connected team:", data.team.id, data.team.name);

    return c.redirect(`${WEB_URL}/settings/integrations/slack?connected=1`, 302);
  } catch (err) {
    console.error("[slack/oauth] Error:", err);
    return c.redirect(`${WEB_URL}/settings/integrations/slack?error=oauth_failed`, 302);
  }
}
