import { agentWantsCaching } from "./caching";
import type { AgentName } from "./models";

export type Capability = "tools" | "streaming" | "prompt-caching";

const base: Set<Capability> = new Set(["tools", "streaming"]);
const baseWithCaching: Set<Capability> = new Set(["tools", "streaming", "prompt-caching"]);

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

export const AGENT_REQUIREMENTS: Record<AgentName, Capability[]> = Object.keys(
  CORE_REQUIREMENTS,
).reduce(
  (acc, key) => {
    const name = key as AgentName;
    const reqs = [...CORE_REQUIREMENTS[name]];
    if (agentWantsCaching(name)) reqs.push("prompt-caching");
    acc[name] = reqs;
    return acc;
  },
  {} as Record<AgentName, Capability[]>,
);
