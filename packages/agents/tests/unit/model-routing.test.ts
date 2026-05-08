import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("Model routing constants", () => {
  it("MODELS.default is claude-sonnet-4-6", async () => {
    const { MODELS } = await import("@/lib/providers");
    expect(MODELS.default).toBe("anthropic/claude-sonnet-4-6");
  });

  it("MODELS.fast is claude-haiku-4-5", async () => {
    const { MODELS } = await import("@/lib/providers");
    expect(MODELS.fast).toBe("anthropic/claude-haiku-4-5-20251001");
  });

  it("MODELS.heavy is claude-opus-4-6", async () => {
    const { MODELS } = await import("@/lib/providers");
    expect(MODELS.heavy).toBe("anthropic/claude-opus-4-6");
  });

  it("AGENT_MODELS agents default to the expected tiers", async () => {
    const { AGENT_MODELS } = await import("@/lib/providers");
    expect(AGENT_MODELS.foreman).toBe("anthropic/claude-sonnet-4-6");
    expect(AGENT_MODELS.discovery).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(AGENT_MODELS.execution).toBe("anthropic/claude-sonnet-4-6");
    expect(AGENT_MODELS.history).toBe("anthropic/claude-haiku-4-5-20251001");
  });
});
