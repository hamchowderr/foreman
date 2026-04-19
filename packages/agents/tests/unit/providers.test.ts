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
  "FOREMAN_TEMPERATURE",
  "FOREMAN_MAX_OUTPUT_TOKENS",
  "FOREMAN_TOP_P",
  "DISCOVERY_TEMPERATURE",
  "DISCOVERY_MAX_OUTPUT_TOKENS",
  "DISCOVERY_TOP_P",
  "EXECUTION_TEMPERATURE",
  "EXECUTION_MAX_OUTPUT_TOKENS",
  "EXECUTION_TOP_P",
  "SUPERVISOR_TEMPERATURE",
  "SUPERVISOR_MAX_OUTPUT_TOKENS",
  "SUPERVISOR_TOP_P",
  "HISTORY_TEMPERATURE",
  "HISTORY_MAX_OUTPUT_TOKENS",
  "HISTORY_TOP_P",
  "FOREMAN_PROMPT_CACHING",
  "DISCOVERY_PROMPT_CACHING",
  "EXECUTION_PROMPT_CACHING",
  "SUPERVISOR_PROMPT_CACHING",
  "HISTORY_PROMPT_CACHING",
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

describe("providers/params", () => {
  it("returns undefined for agents with no env params (Mastra/provider defaults apply)", async () => {
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("foreman")).toBeUndefined();
    expect(modelSettingsFor("discovery")).toBeUndefined();
  });

  it("resolves temperature from env", async () => {
    process.env.DISCOVERY_TEMPERATURE = "0.1";
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("discovery")).toEqual({ temperature: 0.1 });
  });

  it("resolves multiple params for the same agent", async () => {
    process.env.EXECUTION_TEMPERATURE = "0.3";
    process.env.EXECUTION_MAX_OUTPUT_TOKENS = "4096";
    process.env.EXECUTION_TOP_P = "0.95";
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("execution")).toEqual({
      temperature: 0.3,
      maxOutputTokens: 4096,
      topP: 0.95,
    });
  });

  it("ignores non-numeric values (falls back to provider default)", async () => {
    process.env.FOREMAN_TEMPERATURE = "not-a-number";
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("foreman")).toBeUndefined();
  });

  it("scopes params per agent — FOREMAN_* does not leak into discovery", async () => {
    process.env.FOREMAN_TEMPERATURE = "0.7";
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("foreman")).toEqual({ temperature: 0.7 });
    expect(modelSettingsFor("discovery")).toBeUndefined();
  });

  it("accepts integer and decimal forms", async () => {
    process.env.HISTORY_MAX_OUTPUT_TOKENS = "2048";
    process.env.HISTORY_TEMPERATURE = "0";
    const { modelSettingsFor } = await import("@/lib/providers");
    expect(modelSettingsFor("history")).toEqual({
      temperature: 0,
      maxOutputTokens: 2048,
    });
  });
});

describe("providers/caching", () => {
  it("returns plain string system prompt when caching is disabled", async () => {
    const { systemPromptFor } = await import("@/lib/providers");
    expect(systemPromptFor("foreman", "hello")).toBe("hello");
  });

  it("wraps in SystemModelMessage with anthropic.cacheControl when opted in", async () => {
    process.env.FOREMAN_PROMPT_CACHING = "true";
    const { systemPromptFor } = await import("@/lib/providers");
    expect(systemPromptFor("foreman", "hello")).toEqual({
      role: "system",
      content: "hello",
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });
  });

  it("accepts '1' and 'yes' as truthy values", async () => {
    process.env.DISCOVERY_PROMPT_CACHING = "1";
    process.env.EXECUTION_PROMPT_CACHING = "yes";
    const { AGENT_PROMPT_CACHING } = await import("@/lib/providers");
    expect(AGENT_PROMPT_CACHING.discovery).toBe(true);
    expect(AGENT_PROMPT_CACHING.execution).toBe(true);
  });

  it("treats anything else as false (including 'false', 'no', unset)", async () => {
    process.env.FOREMAN_PROMPT_CACHING = "false";
    process.env.DISCOVERY_PROMPT_CACHING = "no";
    const { AGENT_PROMPT_CACHING } = await import("@/lib/providers");
    expect(AGENT_PROMPT_CACHING.foreman).toBe(false);
    expect(AGENT_PROMPT_CACHING.discovery).toBe(false);
    expect(AGENT_PROMPT_CACHING.execution).toBe(false);
  });

  it("adds prompt-caching to AGENT_REQUIREMENTS when opted in", async () => {
    process.env.FOREMAN_PROMPT_CACHING = "true";
    const { AGENT_REQUIREMENTS } = await import("@/lib/providers");
    expect(AGENT_REQUIREMENTS.foreman).toContain("prompt-caching");
    expect(AGENT_REQUIREMENTS.discovery).not.toContain("prompt-caching");
  });

  it("passes validation on Anthropic models that support caching", async () => {
    process.env.FOREMAN_PROMPT_CACHING = "true";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).not.toThrow();
  });

  it("fails validation when caching is enabled on a non-supporting model", async () => {
    process.env.FOREMAN_PROMPT_CACHING = "true";
    process.env.FOREMAN_MODEL = "openai/gpt-4o";
    const { validateAgentCapabilities } = await import("@/lib/providers");
    expect(() => validateAgentCapabilities()).toThrow(/prompt-caching/);
  });
});
