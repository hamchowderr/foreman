/**
 * Inbox prioritization scoring (foreman-6r9y). Pure + deterministic: given an
 * automation's live trigger-inbox state and its recent messages, produce an
 * importance/urgency score, a coarse level, and human-readable reasons. No SDK,
 * no hidden clock — the caller passes `now` (defaults to Date.now()) so the
 * staleness signal is testable.
 *
 * Signals (all read from fields Zapier/Foreman actually expose):
 *   - trigger_failed automation status ......... the trigger itself is broken (critical)
 *   - inbox paused / not active ................ deliveries are halted, needs a human
 *   - messages carrying error_message .......... processing is failing
 *   - messages redelivered (lease_count > 1) ... stuck / repeatedly retried
 *   - stale pending messages (oldest age) ...... backlog aging out
 *   - possible_duplicate_data .................. noise only (surfaced, not scored up)
 */

export interface ScorableMessage {
  created_at: string;
  status: string;
  message_attributes: {
    lease_count: number;
    error_message: string | null;
    possible_duplicate_data: boolean;
  };
}

export interface InboxPriorityInput {
  /** Foreman automation.status — "trigger_failed" means the subscription broke. */
  automationStatus: string;
  enabled: boolean;
  /** Live trigger-inbox status ("active"/"paused"/…) or null when unavailable. */
  inboxStatus: string | null;
  inboxPausedReason: string | null;
  messages: ScorableMessage[];
  /** Injected for deterministic tests; defaults to Date.now(). */
  now?: number;
}

export type InboxPriorityLevel = "high" | "medium" | "low";

export interface InboxPriority {
  score: number;
  level: InboxPriorityLevel;
  reasons: string[];
}

const HIGH_THRESHOLD = 40;
const MEDIUM_THRESHOLD = 15;
const STALE_MS = 60 * 60 * 1000; // pending older than 1h starts adding urgency
const HOUR_MS = 60 * 60 * 1000;

// A message in one of these states is done — it neither ages nor adds backlog.
const TERMINAL_MESSAGE_STATUS = new Set([
  "processed",
  "acked",
  "done",
  "completed",
  "succeeded",
  "success",
]);

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Score one automation's inbox for the "what needs attention" ranking. Higher =
 * more urgent. The reasons array is the human-facing explanation of the score.
 */
export function scoreInboxEntry(input: InboxPriorityInput): InboxPriority {
  const now = input.now ?? Date.now();
  const reasons: string[] = [];
  let score = 0;

  if (input.automationStatus === "trigger_failed") {
    score += 50;
    reasons.push("trigger is failing");
  }

  if ((input.inboxStatus && input.inboxStatus !== "active") || input.inboxPausedReason) {
    score += 20;
    reasons.push(
      input.inboxPausedReason ? `inbox paused: ${input.inboxPausedReason}` : "inbox not active",
    );
  }

  const errored = input.messages.filter((m) => m.message_attributes.error_message).length;
  if (errored > 0) {
    score += Math.min(errored, 5) * 15;
    reasons.push(`${plural(errored, "message")} errored`);
  }

  const stuck = input.messages.filter((m) => m.message_attributes.lease_count > 1).length;
  if (stuck > 0) {
    score += Math.min(stuck, 5) * 10;
    reasons.push(`${plural(stuck, "message")} stuck (redelivered)`);
  }

  const pending = input.messages.filter(
    (m) => !TERMINAL_MESSAGE_STATUS.has(m.status.toLowerCase()),
  );
  if (pending.length > 0) {
    score += Math.min(pending.length, 10) * 3;
    reasons.push(`${plural(pending.length, "pending message")}`);

    const oldest = pending.reduce((min, m) => {
      const t = Date.parse(m.created_at);
      return Number.isNaN(t) ? min : Math.min(min, t);
    }, now);
    const ageMs = now - oldest;
    if (ageMs > STALE_MS) {
      const hours = Math.floor(ageMs / HOUR_MS);
      score += Math.min(hours, 24) * 2;
      reasons.push(`oldest pending ~${hours}h old`);
    }
  }

  const dupes = input.messages.filter((m) => m.message_attributes.possible_duplicate_data).length;
  if (dupes > 0) reasons.push(`${plural(dupes, "possible duplicate")}`);

  if (!input.enabled) reasons.push("automation disabled");

  const level: InboxPriorityLevel =
    score >= HIGH_THRESHOLD ? "high" : score >= MEDIUM_THRESHOLD ? "medium" : "low";

  return { score, level, reasons };
}
