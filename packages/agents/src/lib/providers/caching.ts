/**
 * Anthropic prompt caching opt-in, per agent.
 *
 * When enabled for an agent whose configured model supports `prompt-caching`,
 * the agent's system prompt is wrapped in a `SystemModelMessage` with
 * `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` — the
 * documented AI SDK pattern (see `ai/docs/02-foundations/03-prompts.mdx` line
 * 118–133). Anthropic charges 25% more on cache writes but 90% less on cache
 * hits, which is a net win for agents with long, reused system prompts.
 *
 * Env var per agent:
 *   FOREMAN_PROMPT_CACHING=true
 *   DISCOVERY_PROMPT_CACHING=true
 *   ...
 *
 * When the env var is true AND the agent's configured model doesn't support
 * caching, startup validation fails fast (see capabilities.ts).
 */

import type { AgentName } from "./models";

function parseBoolEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1" || trimmed === "yes";
}

export const AGENT_PROMPT_CACHING: Record<AgentName, boolean> = {
  foreman: parseBoolEnv(process.env.FOREMAN_PROMPT_CACHING),
  discovery: parseBoolEnv(process.env.DISCOVERY_PROMPT_CACHING),
  execution: parseBoolEnv(process.env.EXECUTION_PROMPT_CACHING),
  supervisor: parseBoolEnv(process.env.SUPERVISOR_PROMPT_CACHING),
  history: parseBoolEnv(process.env.HISTORY_PROMPT_CACHING),
};

/**
 * Wrap a system prompt as a SystemModelMessage with anthropic.cacheControl when
 * the agent has prompt caching enabled. Returns the raw string otherwise —
 * Mastra accepts either shape (see llm/index.d.ts `SystemMessage` union).
 */
export function systemPromptFor(agent: AgentName, instructions: string) {
  if (!AGENT_PROMPT_CACHING[agent]) return instructions;
  return {
    role: "system" as const,
    content: instructions,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" as const } },
    },
  };
}
