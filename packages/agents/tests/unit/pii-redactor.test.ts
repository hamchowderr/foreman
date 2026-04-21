import { describe, it, expect } from "vitest";
import { piiRedactor } from "@/lib/processors/output";

describe("PII Redactor", () => {
  describe("processOutputStream (text-delta chunks)", () => {
    async function redactChunk(text: string) {
      const part = { type: "text-delta" as const, payload: { text } };
      const result = await piiRedactor.processOutputStream!({
        part,
        index: 0,
      } as any);
      return result?.payload?.text ?? text;
    }

    it("does NOT redact email addresses (user-provided data)", async () => {
      const result = await redactChunk("Contact us at admin@example.com for help");
      expect(result).toBe("Contact us at admin@example.com for help");
    });

    it("preserves multiple email addresses", async () => {
      const result = await redactChunk("From foo@bar.com to baz@qux.org");
      expect(result).toBe("From foo@bar.com to baz@qux.org");
    });

    it("redacts sk-* API keys", async () => {
      const result = await redactChunk(
        "Your key is sk-abcdefghijklmnopqrstuvwxyz"
      );
      expect(result).toBe("Your key is [API_KEY]");
    });

    it("redacts xoxb-* Slack tokens", async () => {
      const result = await redactChunk(
        "Token: xoxb-1234567890-abcdefghij"
      );
      expect(result).toBe("Token: [API_KEY]");
    });

    it("redacts sk_live_* Stripe keys", async () => {
      const result = await redactChunk(
        "Stripe key: sk_live_abcdefghij1234567890"
      );
      expect(result).toBe("Stripe key: [API_KEY]");
    });

    it("redacts Bearer tokens", async () => {
      const result = await redactChunk(
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
      );
      expect(result).toBe("Authorization: Bearer [TOKEN]");
    });

    it("redacts US phone numbers", async () => {
      const result = await redactChunk("Call me at (555) 123-4567");
      expect(result).toBe("Call me at [PHONE]");
    });

    it("redacts phone numbers with country code", async () => {
      const result = await redactChunk("Phone: +1-555-123-4567");
      expect(result).toBe("Phone: [PHONE]");
    });

    it("redacts credit card numbers", async () => {
      const result = await redactChunk(
        "Card: 4111 1111 1111 1111"
      );
      expect(result).toBe("Card: [CARD]");
    });

    it("redacts SSN patterns", async () => {
      const result = await redactChunk("SSN: 123-45-6789");
      expect(result).toBe("SSN: [SSN]");
    });

    it("passes through text without PII unchanged", async () => {
      const clean = "Hello, how can I help you today?";
      const part = { type: "text-delta" as const, payload: { text: clean } };
      const result = await piiRedactor.processOutputStream!({
        part,
        index: 0,
      } as any);
      // When no redaction needed, returns the original part unchanged
      expect(result.payload.text).toBe(clean);
    });

    it("redacts mixed content — phones and keys but NOT emails", async () => {
      const result = await redactChunk(
        "Email admin@test.com, call (555) 123-4567, key sk-abcdefghijklmnopqrstuvwxyz"
      );
      expect(result).toContain("admin@test.com"); // emails preserved
      expect(result).toContain("[PHONE]");
      expect(result).toContain("[API_KEY]");
    });

    it("does not modify non-text-delta parts", async () => {
      const part = { type: "tool-call" as const, payload: { toolName: "test" } };
      const result = await piiRedactor.processOutputStream!({
        part,
        index: 0,
      } as any);
      expect(result).toEqual(part);
    });
  });

  describe("processOutputResult (persisted messages)", () => {
    it("redacts PII in assistant message text parts", async () => {
      const messages = [
        {
          role: "assistant",
          content: {
            parts: [
              { type: "text", text: "Your email is user@example.com" },
            ],
          },
        },
      ] as any[];

      const result = await piiRedactor.processOutputResult!({
        messages,
      } as any);

      expect(result[0].content.parts[0].text).toBe(
        "Your email is user@example.com"
      );
    });

    it("does not modify user messages", async () => {
      const messages = [
        {
          role: "user",
          content: {
            parts: [
              { type: "text", text: "My email is user@example.com" },
            ],
          },
        },
      ] as any[];

      const result = await piiRedactor.processOutputResult!({
        messages,
      } as any);

      expect(result[0].content.parts[0].text).toBe(
        "My email is user@example.com"
      );
    });

    it("handles messages without parts gracefully", async () => {
      const messages = [
        { role: "assistant", content: "plain string content" },
      ] as any[];

      const result = await piiRedactor.processOutputResult!({
        messages,
      } as any);

      expect(result[0].content).toBe("plain string content");
    });
  });
});
