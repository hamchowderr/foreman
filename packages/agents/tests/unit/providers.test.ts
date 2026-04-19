import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Provider config is resolved at module load from process.env, so each test
 * mutates env and re-imports with a fresh module cache.
 */
const AGENT_ENV_KEYS = [
  "MODEL_DEFAULT",
  "MODEL_FAST",
  "MODEL_HEAVY",
  "FOREMAN_MODEL",
  "DISCOVERY_MODEL",
  "EXECUTION_MODEL",
  "SUPERVISOR_MODEL",
  "HISTORY_MODEL",
] as const;

function clearEnv() {
  for (const k of AGENT_ENV_KEYS) delete process.env[k];
}

beforeEach(() => {
  vi.resetModules();
  clearEnv();
});

afterEach(() => {
  clearEnv();
});

describe("providers/models defaults", () => {
  it("falls back to hardcoded Anthropic tier defaults when no env set", async () => {
    const { MODELS, AGENT_MODELS } = await import("@/lib/providers");
    expect(MODELS.default).toBe("anthropic/claude-sonnet-4-6");
    expect(MODELS.fast).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(MODELS.heavy).toBe("anthropic/claude-opus-4-6");
    expect(AGENT_MODELS.foreman).toBe("anthropic/claude-sonnet-4-6");
    expect(AGENT_MODELS.discovery).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(AGENT_MODELS.history).toBe("anthropic/claude-haiku-4-5-20251001");
  });

  it("tier env vars override tier defaults and flow into agents", async () => {
    process.env.MODEL_DEFAULT = "openai/gpt-4o";
    process.env.MODEL_FAST = "openai/gpt-4o-mini";
    const { MODELS, AGENT_MODELS } = await import("@/lib/providers");
    expect(MODELS.default).toBe("openai/gpt-4o");
    expect(AGENT_MODELS.foreman).toBe("openai/gpt-4o");
    expect(AGENT_MODELS.execution).toBe("openai/gpt-4o");
    expect(AGENT_MODELS.discovery).toBe("openai/gpt-4o-mini");
  });

  it("per-agent env var wins over tier default", async () => {
    process.env.MODEL_FAST = "openai/gpt-4o-mini";
    process.env.DISCOVERY_MODEL = "google/gemini-2.5-flash";
    const { AGENT_MODELS } = await import("@/lib/providers");
    expect(AGENT_MODELS.discovery).toBe("google/gemini-2.5-flash");
    // history still follows tier default
    expect(AGENT_MODELS.history).toBe("openai/gpt-4o-mini");
  });

  it("comma-separated per-agent value produces a ModelWithRetries fallback chain", async () => {
    process.env.EXECUTION_MODEL =
      "anthropic/claude-sonnet-4-6,openai/gpt-4o,google/gemini-2.5-pro";
    const { AGENT_MODELS, asList, primary } = await import("@/lib/providers");
    const spec = AGENT_MODELS.execution;
    expect(Array.isArray(spec)).toBe(true);
    expect(asList(spec)).toEqual([
      "anthropic/claude-sonnet-4-6",
      "openai/gpt-4o",
      "google/gemini-2.5-pro",
    ]);
    expect(primary(spec)).toBe("anthropic/claude-sonnet-4-6");
    // chain entries have the Mastra-compatible shape
    if (Array.isArray(spec)) {
      expect(spec[0]).toMatchObject({ model: "anthropic/claude-sonnet-4-6", maxRetries: 2 });
    }
  });

  it("whitespace and empty entries in a chain are tolerated", async () => {
    process.env.EXECUTION_MODEL = " anthropic/claude-sonnet-4-6 , , openai/gpt-4o ";
    const { AGENT_MODELS, asList } = await import("@/lib/providers");
    expect(asList(AGENT_MODELS.execution)).toEqual([
      "anthropic/claude-sonnet-4-6",
      "openai/gpt-4o",
    ]);
  });

  it("single-entry chain collapses to a string", async () => {
    process.env.EXECUTION_MODEL = "openai/gpt-4o";
    const { AGENT_MODELS } = await import("@/lib/providers");
    expect(AGENT_MODELS.execution).toBe("openai/gpt-4o");
  });
});

describe("providers/validate", () => {
  it("passes on default config", async () => {
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).not.toThrow();
  });

  it("passes when every agent is set to a supported cross-provider model", async () => {
    process.env.FOREMAN_MODEL = "openai/gpt-4o";
    process.env.DISCOVERY_MODEL = "google/gemini-2.5-flash";
    process.env.EXECUTION_MODEL = "openai/gpt-4o";
    process.env.SUPERVISOR_MODEL = "google/gemini-2.5-pro";
    process.env.HISTORY_MODEL = "openai/gpt-4o-mini";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).not.toThrow();
  });

  it("fails on an unknown model string (catches typos)", async () => {
    process.env.EXECUTION_MODEL = "anthropic/claude-sonnet-999-typo";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/unknown model/i);
  });

  it("fails on every entry of a fallback chain that contains an unknown model", async () => {
    process.env.EXECUTION_MODEL = "anthropic/claude-sonnet-4-6,bogus/model-x";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/bogus\/model-x/);
  });

  it("error message names the agent and the offending model", async () => {
    process.env.DISCOVERY_MODEL = "fake/provider-y";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/discovery/);
    expect(() => validateAgentCapabilities()).toThrow(/fake\/provider-y/);
  });
});
