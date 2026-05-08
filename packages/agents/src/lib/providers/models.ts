/**
 * Provider-flexible model configuration.
 *
 * Resolution order for each agent's model:
 *   1. Per-agent env var (e.g. EXECUTION_MODEL)
 *   2. Tier env var (MODEL_DEFAULT / MODEL_FAST / MODEL_HEAVY)
 *   3. Hardcoded tier default (Anthropic)
 *
 * Per-agent env vars accept a single `provider/model` string OR a
 * comma-separated fallback chain that Mastra retries down on transient errors:
 *   EXECUTION_MODEL=anthropic/claude-sonnet-4-6,openai/gpt-4o
 */

export type ModelFallback = { model: string; maxRetries?: number };
export type ModelSpec = string | ModelFallback[];

const TIER_DEFAULTS = {
  default: "anthropic/claude-sonnet-4-6",
  fast: "anthropic/claude-haiku-4-5-20251001",
  heavy: "anthropic/claude-opus-4-6",
} as const;

const FALLBACK_MAX_RETRIES = 2;

function single(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function chain(value: string | undefined, fallback: string): ModelSpec {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return parts.map((model) => ({ model, maxRetries: FALLBACK_MAX_RETRIES }));
}

export const MODELS = {
  default: single(process.env.MODEL_DEFAULT, TIER_DEFAULTS.default),
  fast: single(process.env.MODEL_FAST, TIER_DEFAULTS.fast),
  heavy: single(process.env.MODEL_HEAVY, TIER_DEFAULTS.heavy),
} as const;

export const AGENT_MODELS = {
  foreman: chain(process.env.FOREMAN_MODEL, MODELS.default),
  discovery: chain(process.env.DISCOVERY_MODEL, MODELS.fast),
  execution: chain(process.env.EXECUTION_MODEL, MODELS.default),
  supervisor: chain(process.env.SUPERVISOR_MODEL, MODELS.default),
  history: chain(process.env.HISTORY_MODEL, MODELS.fast),
} as const;

export type AgentName = keyof typeof AGENT_MODELS;

export function primary(spec: ModelSpec): string {
  return typeof spec === "string" ? spec : spec[0].model;
}

export function asList(spec: ModelSpec): string[] {
  return typeof spec === "string" ? [spec] : spec.map((e) => e.model);
}
