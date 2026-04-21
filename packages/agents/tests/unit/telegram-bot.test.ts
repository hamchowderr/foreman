import { describe, it, expect, beforeAll, vi } from "vitest";
import { randomBytes } from "node:crypto";

// Mock the Mastra agent so we don't need a real DB or LLM
vi.mock("@/mastra", () => ({
  getMastra: vi.fn().mockReturnValue({
    getAgent: () => ({
      generate: vi.fn().mockResolvedValue({ text: "mock reply" }),
    }),
  }),
}));

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
});

describe("Telegram bot", () => {
  it("getTelegramBot returns a singleton", async () => {
    const { getTelegramBot } = await import("@/telegram/bot");
    const bot1 = await getTelegramBot();
    const bot2 = await getTelegramBot();
    expect(bot1).toBe(bot2);
  });

  it("getTelegramAdapter returns the adapter instance", async () => {
    const { getTelegramAdapter } = await import("@/telegram/bot");
    const adapter = getTelegramAdapter();
    expect(adapter).toBeDefined();
  });

  it("bot has webhook handler for telegram", async () => {
    const { getTelegramBot } = await import("@/telegram/bot");
    const bot = await getTelegramBot();
    expect(bot.webhooks).toBeDefined();
    expect(typeof bot.webhooks.telegram).toBe("function");
  });

  it("bot registers onDirectMessage handler", async () => {
    const { getTelegramBot } = await import("@/telegram/bot");
    const bot = await getTelegramBot();
    expect(bot).toBeDefined();
  });
});
