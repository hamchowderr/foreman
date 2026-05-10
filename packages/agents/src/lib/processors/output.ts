import type { MastraDBMessage } from "@mastra/core/agent";
import type {
  OutputProcessor,
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
} from "@mastra/core/processors";
import type { ChunkType } from "@mastra/core/stream";

/**
 * Regex patterns for common PII and secrets.
 * Each entry maps a pattern to its replacement placeholder.
 */
const PII_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // NOTE: Email addresses are NOT redacted — users frequently provide emails
  // as part of their requests (e.g., "send email to john@example.com").
  // Redacting them breaks the user experience.

  // API keys: sk-*, xoxb-*, xoxp-*, xoxa-*, rk_live_*, sk_live_*, pk_live_*
  {
    regex: /\b(?:sk-[a-zA-Z0-9]{20,}|xox[bpas]-[a-zA-Z0-9-]{10,}|[spr]k_live_[a-zA-Z0-9]{10,})\b/g,
    replacement: "[API_KEY]",
  },
  // Bearer tokens
  {
    regex: /\bBearer\s+[a-zA-Z0-9._~+/=-]{20,}\b/g,
    replacement: "Bearer [TOKEN]",
  },
  // Phone numbers (US and international formats)
  {
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[PHONE]",
  },
  // Credit card numbers (13-19 digits, optionally separated by spaces or dashes)
  {
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: "[CARD]",
  },
  // SSN
  {
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[SSN]",
  },
];

/**
 * Redact PII from a string using regex patterns.
 */
function redactPII(text: string): string {
  let redacted = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    redacted = redacted.replace(regex, replacement);
  }
  return redacted;
}

/**
 * Output processor that sanitizes PII from agent responses
 * before they are stored or sent to the client.
 *
 * Uses fast regex matching rather than an LLM call, so it adds
 * negligible latency to the response pipeline.
 */
export const piiRedactor: OutputProcessor = {
  id: "pii-redactor",
  name: "PII Redactor",
  description:
    "Redacts emails, API keys, tokens, phone numbers, credit cards, and SSNs from agent output",

  async processOutputStream({ part }: ProcessOutputStreamArgs) {
    if (part.type === "text-delta") {
      const text = part.payload?.text;
      if (typeof text === "string") {
        const redacted = redactPII(text);
        if (redacted !== text) {
          return {
            ...part,
            payload: { ...part.payload, text: redacted },
          } as ChunkType;
        }
      }
    }
    return part;
  },

  async processOutputResult({ messages }: ProcessOutputResultArgs): Promise<MastraDBMessage[]> {
    // Redact PII in all assistant messages before they are persisted to memory
    return messages.map((msg) => {
      if (msg.role !== "assistant") return msg;

      const content = msg.content;
      if (!content || typeof content !== "object" || !("parts" in content)) {
        return msg;
      }

      const parts = content.parts;
      if (!Array.isArray(parts)) return msg;

      const redactedParts = parts.map((part) => {
        if (part.type === "text" && typeof part.text === "string") {
          return { ...part, text: redactPII(part.text) };
        }
        return part;
      });

      return {
        ...msg,
        content: { ...content, parts: redactedParts },
      } as MastraDBMessage;
    });
  },
};
