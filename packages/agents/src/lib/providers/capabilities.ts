/**
 * Model capability registry.
 *
 * Tracks only the capabilities Foreman actually uses today.
 * When a new feature is added (prompt caching, extended thinking, vision, ...)
 * add the capability to `Capability`, populate it for each model that supports
 * it, and declare the requirement on agents that use it.
 *
 * This registry is hand-curated. Mastra ships a capability matrix in its docs
 * but does not expose it as runtime data.
 */

import type { AgentName } from "./models";
import { AGENT_PROMPT_CACHING } from "./caching";

export type Capability = "tools" | "streaming" | "prompt-caching";

const base: Set<Capability> = new Set(["tools", "streaming"]);
const baseWithCaching: Set<Capability> = new Set([
  "tools",
  "streaming",
  "prompt-caching",
]);

/**
 * Models Foreman is tested against. Unknown models fail startup validation.
 * Only Anthropic Claude variants expose explicit cache_control; OpenAI has
 * automatic prefix caching (not opt-in via an API flag) and Gemini/others
 * don't have an equivalent AI SDK surface, so `prompt-caching` is Anthropic-
 * only here.
 */
export const MODEL_CAPABILITIES: Record<string, Set<Capability>> = {
  // Anthropic
  "anthropic/claude-sonnet-4-6": baseWithCaching,
  "anthropic/claude-haiku-4-5-20251001": baseWithCaching,
  "anthropic/claude-haiku-4-5": baseWithCaching,
  "anthropic/claude-opus-4-6": baseWithCaching,

  // OpenAI
  "openai/gpt-4o": base,
  "openai/gpt-4o-mini": base,
  "openai/gpt-4-turbo": base,
  "openai/gpt-4.1": base,
  "openai/gpt-4.1-mini": base,

  // Google
  "google/gemini-2.5-flash": base,
  "google/gemini-2.5-pro": base,
  "google/gemini-2.0-flash": base,
  "google/gemini-1.5-pro": base,
};

const CORE_REQUIREMENTS: Record<AgentName, Capability[]> = {
  foreman: ["tools", "streaming"],
  discovery: ["tools"],
  execution: ["tools", "streaming"],
  supervisor: ["tools"],
  history: ["tools"],
};

/**
 * Capabilities each agent requires. Core requirements are static; optional
 * requirements (e.g. prompt-caching) are added when the corresponding env
 * opt-in is set, so startup validation fails fast if you enable caching on an
 * agent whose configured model doesn't support it.
 */
export const AGENT_REQUIREMENTS: Record<AgentName, Capability[]> = Object.keys(
  CORE_REQUIREMENTS,
).reduce((acc, key) => {
  const name = key as AgentName;
  const reqs = [...CORE_REQUIREMENTS[name]];
  if (AGENT_PROMPT_CACHING[name]) reqs.push("prompt-caching");
  acc[name] = reqs;
  return acc;
}, {} as Record<AgentName, Capability[]>);
