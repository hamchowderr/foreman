/**
 * Channel-trigger matcher. Channel webhook handlers (slack/discord/telegram/etc.)
 * call `matchAndFireChannelTriggers` on every inbound message. If any
 * `workflow_trigger` row of type='channel' matches the channel + criteria,
 * the workflow is fired (in the background — the handler still replies
 * normally).
 *
 * Match semantics:
 *   - `channel` field MUST equal the inbound channel name.
 *   - `match.command` (optional): exact text match against the message body.
 *     Leading slashes, bangs and surrounding whitespace are tolerated so
 *     "!standup", "/standup", " standup " all match the rule "!standup".
 *   - `match.from` (optional): regex on the sender id/handle.
 *   - `match.room` (optional): exact match on room/channel/DM target.
 *
 * All provided criteria must pass — empty match = matches every message
 * on that channel (rarely what you want, but supported).
 */

import { getSupabase } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflows/engine";

export interface ChannelMessage {
  channel: "slack" | "discord" | "telegram" | "linear" | "github" | "gchat" | "teams" | "whatsapp";
  text: string;
  /** Sender handle/userId — used by `match.from`. */
  from: string;
  /** Channel/room/DM target — used by `match.room`. */
  room?: string;
}

interface ChannelTriggerRow {
  id: string;
  workflow_id: string;
  config: string;
}

/** Strip leading `/` or `!` and trim — used for `match.command`. */
function normalizeCommand(s: string): string {
  return s.trim().replace(/^[/!]\s*/, "");
}

export async function matchAndFireChannelTriggers(msg: ChannelMessage): Promise<number> {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from("workflow_trigger")
    .select("id, workflow_id, config")
    .eq("type", "channel")
    .eq("enabled", true);
  if (error) {
    console.error(`[channel-trigger] fetch failed: ${error.message}`);
    return 0;
  }

  let fired = 0;
  for (const row of (rows ?? []) as unknown as ChannelTriggerRow[]) {
    let cfg: { channel?: string; match?: { command?: string; from?: string; room?: string } };
    try {
      cfg = JSON.parse(row.config);
    } catch {
      continue;
    }
    if (cfg.channel !== msg.channel) continue;
    const m = cfg.match ?? {};
    if (m.command && normalizeCommand(msg.text) !== normalizeCommand(m.command)) continue;
    if (m.from && !new RegExp(m.from).test(msg.from)) continue;
    if (m.room && msg.room !== m.room) continue;

    const { data: wf } = await supabase
      .from("workflow")
      .select("user_id")
      .eq("id", row.workflow_id)
      .maybeSingle();
    if (!wf) continue;

    void runOne(row.workflow_id, wf.user_id as string, row.id);
    fired++;
  }
  return fired;
}

async function runOne(workflowId: string, userId: string, triggerId: string) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  try {
    await supabase
      .from("workflow_trigger")
      .update({ last_fired_at: now, updated_at: now })
      .eq("id", triggerId);
    for await (const ev of executeWorkflow(workflowId, userId, {})) {
      if (ev.type === "error") {
        console.warn(`[channel-trigger] ${triggerId} workflow error: ${ev.message}`);
      }
    }
  } catch (err) {
    console.error(`[channel-trigger] trigger ${triggerId} failed:`, err);
  }
}
