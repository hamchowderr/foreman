import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * End-to-end verification that per-agent model env overrides route
 * `agent.generate()` to the correct provider SDK.
 *
 * AIMock (wired in tests/aimock-setup.ts) intercepts both provider base URLs
 * by setting ANTHROPIC_BASE_URL and OPENAI_BASE_URL to the mock endpoint.
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

describe("provider swap via AIMock", () => {
  const memoryOpts = {
    memory: { thread: "test-thread", resource: "test-user" },
  };

  it("returns text on default (Anthropic) config", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-provider-swap.db");

    const result = await agent.generate("hello", memoryOpts);
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
  }, 60000);

  it("parses a fallback chain into a Mastra-shaped array", async () => {
    process.env.EXECUTION_MODEL = "openai/gpt-4o,anthropic/claude-sonnet-4-6";
    const { AGENT_MODELS, asList, primary } = await import("@/lib/providers");

    const spec = AGENT_MODELS.execution;
    expect(Array.isArray(spec)).toBe(true);
    expect(asList(spec)).toEqual([
      "openai/gpt-4o",
      "anthropic/claude-sonnet-4-6",
    ]);
    expect(primary(spec)).toBe("openai/gpt-4o");
  });

  it("aborts startup validation when a configured model is unknown", async () => {
    process.env.FOREMAN_MODEL = "anthropic/claude-sonnet-999-typo";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/unknown model/i);
  });
});
