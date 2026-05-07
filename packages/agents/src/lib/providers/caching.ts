/**
 * Anthropic prompt caching opt-ins, per agent.
 *
 * Two independent switches:
 *   <AGENT>_PROMPT_CACHING   — caches the agent's system prompt
 *   <AGENT>_TOOL_CACHING     — caches the agent's tool schemas
 *
 * Both gate on the `prompt-caching` capability — startup validation fails
 * if enabled on an agent whose model doesn't support caching.
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

export const AGENT_TOOL_CACHING: Record<AgentName, boolean> = {
  foreman: parseBoolEnv(process.env.FOREMAN_TOOL_CACHING),
  discovery: parseBoolEnv(process.env.DISCOVERY_TOOL_CACHING),
  execution: parseBoolEnv(process.env.EXECUTION_TOOL_CACHING),
  supervisor: parseBoolEnv(process.env.SUPERVISOR_TOOL_CACHING),
  history: parseBoolEnv(process.env.HISTORY_TOOL_CACHING),
};

export function agentWantsCaching(agent: AgentName): boolean {
  return AGENT_PROMPT_CACHING[agent] || AGENT_TOOL_CACHING[agent];
}

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

export function toolsWithCacheControl<T extends Record<string, unknown>>(
  agent: AgentName,
  tools: T,
): T {
  if (!AGENT_TOOL_CACHING[agent]) return tools;
  const keys = Object.keys(tools);
  if (keys.length === 0) return tools;
  const lastKey = keys[keys.length - 1];
  const lastTool = tools[lastKey];
  if (!lastTool || typeof lastTool !== "object") return tools;
  const existingOpts =
    (lastTool as { providerOptions?: Record<string, unknown> }).providerOptions ?? {};
  return {
    ...tools,
    [lastKey]: {
      ...(lastTool as Record<string, unknown>),
      providerOptions: {
        ...existingOpts,
        anthropic: { cacheControl: { type: "ephemeral" as const } },
      },
    },
  } as T;
}
