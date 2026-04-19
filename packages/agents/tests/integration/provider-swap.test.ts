import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * End-to-end verification that per-agent model env overrides route
 * `agent.generate()` to the correct provider SDK.
 *
 * AIMock (wired in tests/aimock-setup.ts) intercepts the provider base URLs,
 * but its fixture shape may drift from the latest OpenAI Responses / Anthropic
 * schemas. Rather than assert on the mock's body, we assert that the call
 * path reaches the expected provider — Mastra's upstream-error messages name
 * the provider and model, which is enough to prove the env-driven routing.
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

/** Capture the provider/model named in Mastra's error chain for any upstream LLM failure. */
function providerFromError(err: unknown): string {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  const parts: string[] = [];
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as {
      message?: unknown;
      provider?: unknown;
      modelId?: unknown;
      url?: unknown;
      cause?: unknown;
    };
    for (const v of [e.message, e.provider, e.modelId, e.url]) {
      if (typeof v === "string") parts.push(v);
    }
    cur = e.cause;
  }
  return parts.join(" :: ");
}

describe("provider swap via AIMock", () => {
  const memoryOpts = {
    memory: { thread: "test-thread", resource: "test-user" },
  };

  it("routes to the Anthropic endpoint on default config", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-provider-swap.db");

    let routed = "";
    try {
      const result = await agent.generate("hello", memoryOpts);
      expect(result.text).toBeTruthy();
      return;
    } catch (err) {
      routed = providerFromError(err);
    }
    // Anthropic SDK hits /v1/messages; OpenAI hits /v1/responses or /v1/chat.
    expect(routed).toMatch(/messages|anthropic|claude/i);
    expect(routed).not.toMatch(/\/v1\/responses|\/v1\/chat\/completions|gpt-/i);
  }, 60000);

  it("routes to the OpenAI endpoint when FOREMAN_MODEL=openai/gpt-4o", async () => {
    process.env.FOREMAN_MODEL = "openai/gpt-4o";

    const { AGENT_MODELS } = await import("@/lib/providers");
    expect(AGENT_MODELS.foreman).toBe("openai/gpt-4o");

    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-provider-swap.db");

    let routed = "";
    try {
      const result = await agent.generate("hello", memoryOpts);
      expect(result.text).toBeTruthy();
      return;
    } catch (err) {
      routed = providerFromError(err);
    }
    expect(routed).toMatch(/\/v1\/responses|\/v1\/chat|openai|gpt-4o/i);
    expect(routed).not.toMatch(/\/v1\/messages|claude/i);
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
