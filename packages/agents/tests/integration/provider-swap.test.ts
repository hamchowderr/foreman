import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Per-agent model env overrides: fallback-chain parsing and startup validation.
 * Real agent turns through AIMock live in agent-turns.test.ts.
 */

const ENV_KEYS_TO_CLEAR = [
  "MODEL_DEFAULT",
  "MODEL_FAST",
  "MODEL_HEAVY",
  "FOREMAN_MODEL",
  "DISCOVERY_MODEL",
  "EXECUTION_MODEL",
  "SUPERVISOR_MODEL",
  "HISTORY_MODEL",
] as const;

beforeEach(() => {
  vi.resetModules();
  for (const k of ENV_KEYS_TO_CLEAR) delete process.env[k];
  process.env.DATABASE_URL = "file:./test-provider-swap.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.OPENAI_API_KEY = "sk-test-fake-key";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake-key";
});

afterEach(() => {
  for (const k of ENV_KEYS_TO_CLEAR) delete process.env[k];
});

describe("provider swap", () => {
  it("parses a fallback chain into a Mastra-shaped array", async () => {
    process.env.EXECUTION_MODEL = "openai/gpt-4o,anthropic/claude-sonnet-4-6";
    const { AGENT_MODELS, asList, primary } = await import("@/lib/providers");

    const spec = AGENT_MODELS.execution;
    expect(Array.isArray(spec)).toBe(true);
    expect(asList(spec)).toEqual(["openai/gpt-4o", "anthropic/claude-sonnet-4-6"]);
    expect(primary(spec)).toBe("openai/gpt-4o");
  });

  it("aborts startup validation when a configured model is unknown", async () => {
    process.env.FOREMAN_MODEL = "anthropic/claude-sonnet-999-typo";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/unknown model/i);
  });
});
