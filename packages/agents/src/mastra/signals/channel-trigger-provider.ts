/**
 * ChannelTriggerSignalProvider — a Mastra SignalProvider, hosted on the foreman
 * agent, that fires saved workflows when an inbound chat message matches a
 * `workflow_trigger` of type='channel'.
 *
 * Like the poll provider, it lives ON the agent (`signals: [...]`) so it's a
 * first-class Mastra primitive with `connect()`/`notify()`. It has no
 * `pollInterval` — it's event-driven: the channel webhook handlers call
 * `handleMessage()` on every inbound message (via the thin
 * `matchAndFireChannelTriggers` wrapper in workflows/channel-trigger.ts).
 *
 * Dedup (fixes foreman-tv5p): a retried webhook re-delivers the same message,
 * which previously fired the workflow twice. We derive a delivery key — the
 * caller-supplied `dedupeKey` (e.g. the platform message id) when available,
 * else a content hash of channel|room|from|text — and skip a trigger whose
 * persisted `last_dedupe_key` already equals it. The content-hash fallback
 * catches retries (identical content) but would also coalesce a user sending
 * the *exact same* text back-to-back; callers that pass a real message id avoid
 * that edge entirely (tracked as a follow-up).
 *
 * On a fresh fire we also drop a notification signal (native `dedupeKey`) into
 * the user's thread — additive and best-effort, never blocking the run.
 */

import { createHash } from "node:crypto";
import { SignalProvider } from "@mastra/core/signals";
import { getSupabase } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflows/engine";
import type { ChannelMessage } from "@/workflows/channel-trigger";

interface ChannelTriggerRow {
  id: string;
  workflow_id: string;
  config: string;
  last_dedupe_key: string | null;
}

/** Strip leading `/` or `!` and trim — used for `match.command`. */
function normalizeCommand(s: string): string {
  return s.trim().replace(/^[/!]\s*/, "");
}

/** Stable delivery key for a message: the caller's id if given, else a content
 * hash. Identical (retried) deliveries produce the same key. */
function deliveryKey(msg: ChannelMessage): string {
  if (msg.dedupeKey) return msg.dedupeKey;
  return createHash("sha1")
    .update(`${msg.channel}|${msg.room ?? ""}|${msg.from}|${msg.text}`)
    .digest("hex");
}

export class ChannelTriggerSignalProvider extends SignalProvider<"channel-trigger"> {
  readonly id = "channel-trigger" as const;
  readonly name = "Channel Trigger Signals";
  // No pollInterval — event-driven via handleMessage().

  /** Drop a best-effort notification into the user's thread on a fresh fire. */
  private async notifyOwner(msg: ChannelMessage, userId: string, key: string): Promise<void> {
    if (!this.agent) return;
    try {
      await this.notify(
        {
          source: "channel-trigger",
          kind: msg.channel,
          summary: `Workflow triggered by a ${msg.channel} message`,
          payload: { from: msg.from, room: msg.room, text: msg.text },
          dedupeKey: key,
        },
        { threadId: `channel:${msg.channel}:${msg.room ?? msg.from}`, resourceId: userId },
      );
    } catch (err) {
      console.warn(`[channel-trigger] notify failed (${msg.channel}):`, err);
    }
  }

  /**
   * Match an inbound message against channel triggers and fire each match's
   * workflow exactly once per delivery. Returns the number of workflows fired.
   */
  async handleMessage(msg: ChannelMessage): Promise<number> {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("workflow_trigger")
      .select("id, workflow_id, config, last_dedupe_key")
      .eq("type", "channel")
      .eq("enabled", true);
    if (error) {
      console.error(`[channel-trigger] fetch failed: ${error.message}`);
      return 0;
    }

    const key = deliveryKey(msg);
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

      // Dedup: same delivery already fired this trigger → skip (retried webhook).
      if (row.last_dedupe_key && row.last_dedupe_key === key) continue;

      const { data: wf } = await supabase
        .from("workflow")
        .select("user_id")
        .eq("id", row.workflow_id)
        .maybeSingle();
      if (!wf) continue;

      const userId = wf.user_id as string;
      const now = new Date().toISOString();
      // Record the delivery key BEFORE firing so a concurrent retry can't race
      // a second run in. last_fired_at doubles as the fire timestamp.
      await supabase
        .from("workflow_trigger")
        .update({ last_dedupe_key: key, last_fired_at: now, updated_at: now })
        .eq("id", row.id);

      try {
        for await (const ev of executeWorkflow(row.workflow_id, userId, {}, undefined, {
          firedBy: "channel",
          triggerId: row.id,
        })) {
          if (ev.type === "error") {
            console.warn(`[channel-trigger] ${row.id} workflow error: ${ev.message}`);
          }
        }
        fired++;
        await this.notifyOwner(msg, userId, key);
      } catch (err) {
        console.error(`[channel-trigger] trigger ${row.id} failed:`, err);
      }
    }
    return fired;
  }
}

/** Singleton hosted on the foreman agent (`signals: [...]`). */
export const channelTriggerProvider = new ChannelTriggerSignalProvider();
