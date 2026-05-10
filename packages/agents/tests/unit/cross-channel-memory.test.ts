import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cross-channel memory design verification.
 *
 * Mastra Memory uses two keys:
 *   - thread: scopes the conversation history (channel-specific)
 *   - resource: scopes semantic recall (unified user ID)
 *
 * Because all bots pass the same Foreman userId as `resource`, semantic recall
 * works across channels — what a user says on Discord is available when they
 * message from Slack, Telegram, etc.
 *
 * These tests verify that every bot file follows this pattern correctly by
 * reading the source and checking for the expected memory config shape.
 */

const CHANNELS = [
  "telegram",
  "slack",
  "discord",
  "teams",
  "gchat",
  "whatsapp",
  "github",
  "linear",
  "imessage",
] as const;

function readBotSource(channel: string): string {
  const path = resolve(__dirname, `../../src/${channel}/bot.ts`);
  return readFileSync(path, "utf-8");
}

describe("cross-channel memory config", () => {
  for (const channel of CHANNELS) {
    describe(channel, () => {
      let source: string;

      it("bot file exists and is readable", () => {
        source = readBotSource(channel);
        expect(source).toBeTruthy();
      });

      it("calls registerChannelUser before agent.generate", () => {
        source = readBotSource(channel);
        const registerIdx = source.indexOf("registerChannelUser");
        const generateIdx = source.indexOf("agent.generate");
        expect(registerIdx).toBeGreaterThan(-1);
        expect(generateIdx).toBeGreaterThan(-1);
        expect(registerIdx).toBeLessThan(generateIdx);
      });

      it("passes unified userId as resource (not raw channel user ID)", () => {
        source = readBotSource(channel);
        // The resource field should use the resolved `userId` variable,
        // NOT the raw channel-specific ID parameter
        expect(source).toMatch(/resource:\s*userId/);
        // Should NOT pass the raw channel user ID as resource
        const rawParam = `${channel}UserId`;
        expect(source).not.toMatch(new RegExp(`resource:\\s*${rawParam}`));
      });

      it("uses channel-prefixed thread ID", () => {
        source = readBotSource(channel);
        expect(source).toMatch(new RegExp(`thread:\\s*\`${channel}-\\$\\{threadId\\}\``));
      });

      it("imports registerChannelUser from identity module", () => {
        source = readBotSource(channel);
        expect(source).toMatch(
          /import\s*\{[^}]*registerChannelUser[^}]*\}\s*from\s*["'].*identity["']/,
        );
      });
    });
  }

  it("all channels share the same resource field pattern for cross-channel recall", () => {
    const resourcePatterns = CHANNELS.map((channel) => {
      const source = readBotSource(channel);
      const match = source.match(/resource:\s*(\w+)/);
      return match?.[1];
    });

    // Every bot must use the same variable name for resource
    const unique = new Set(resourcePatterns);
    expect(unique.size).toBe(1);
    expect(unique.has("userId")).toBe(true);
  });
});
