/**
 * Anthropic prompt caching opt-ins, per agent.
 *
 * Two independent switches:
 *   <AGENT>_PROMPT_CACHING   — caches the agent's system prompt
 *   <AGENT>_TOOL_CACHING     — caches the agent's tool schemas
 *
 * They are kept separate because Anthropic charges 25% more on cache writes
 * but 90% less on hits. System prompts typically need ~5+ reuses to break
 * even, while tool schemas (often much larger) break even after 1-2 reuses.
 * Keeping them decoupled lets operators tune each per agent.
 *
 * Both switches gate on the `prompt-caching` capability — if either is true
 * and the configured model doesn't support caching, startup validation fails.
 *
 * Documented surfaces:
 *   - System prompt: AI SDK attaches `providerOptions` to system messages
 *     (ai/docs/02-foundations/03-prompts.mdx:118–133).
 *   - Tool schemas: Mastra's Anthropic adapter reads each tool's
 *     providerOptions and emits `cache_control` on the tool definition
 *     (chunk-3RIGZMZ5.js:14612–14631). Anthropic supports up to 4 cache
 *     breakpoints per request; setting cache_control on the *last* tool
 *     creates one breakpoint that caches every earlier tool as one block.
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

/** True when the agent opted into either caching mode. */
export function agentWantsCaching(agent: AgentName): boolean {
  return AGENT_PROMPT_CACHING[agent] || AGENT_TOOL_CACHING[agent];
}

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

/**
 * Attach anthropic.cacheControl to the last tool in the map when the agent
 * has tool caching enabled. Creates one Anthropic cache breakpoint that
 * covers every earlier tool definition — chosen over per-tool breakpoints
 * because Anthropic caps breakpoints at 4 per request and a single
 * trailing breakpoint caches the entire schema block with no waste.
 */
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
