import type { createSlackAdapter } from "@chat-adapter/slack";
import { decryptToken } from "../lib/crypto";
import { getSupabase } from "../lib/db";

/**
 * Load every stored Slack workspace install into an adapter, decrypting the bot
 * tokens on the way in.
 *
 * Lives in its own module rather than in `bot.ts` because BOTH Slack paths need
 * it — the custom bot and the native-channels adapter (`channel.ts`) — and
 * `bot.ts` imports `getMastra()`. Importing it from the agent config would
 * close a cycle (mastra/index → agents/foreman → slack/channel → slack/bot →
 * mastra/index), which type-checks fine and then hands one of those modules an
 * undefined binding at runtime. One implementation, no cycle: a change to how
 * installs are stored cannot fix one path and silently break the other.
 *
 * Must run AFTER the adapter's `initialize`, which is what wires up the state
 * store `setInstallation` writes to. One adapter holds many workspaces.
 */
export async function rehydrateSlackInstallations(
  adapter: Pick<ReturnType<typeof createSlackAdapter>, "setInstallation">,
): Promise<void> {
  const db = getSupabase();
  const { data, error } = await db
    .from("slack_installation")
    .select("team_id, team_name, bot_token, bot_user_id");
  if (error || !data?.length) return;
  for (const row of data) {
    try {
      await adapter.setInstallation(row.team_id, {
        botToken: decryptToken(row.bot_token),
        botUserId: row.bot_user_id ?? undefined,
        teamName: row.team_name ?? undefined,
      });
    } catch (err) {
      console.error("[slack] Failed to rehydrate team", row.team_id, err);
    }
  }
  console.log(`[slack] Rehydrated ${data.length} installation(s) from DB`);
}
