import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("Model routing constants", () => {
  it("MODELS.default is claude-sonnet-4-6", async () => {
    const { MODELS } = await import("@/mastra/agents/foreman");
    expect(MODELS.default).toBe("anthropic/claude-sonnet-4-6");
  });

  it("MODELS.fast is claude-haiku-4-5", async () => {
    const { MODELS } = await import("@/mastra/agents/foreman");
    expect(MODELS.fast).toBe("anthropic/claude-haiku-4-5-20251001");
  });

  it("MODELS.heavy is claude-opus-4-6", async () => {
    const { MODELS } = await import("@/mastra/agents/foreman");
    expect(MODELS.heavy).toBe("anthropic/claude-opus-4-6");
  });
});
