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

export type Capability = "tools" | "streaming";

const tools_streaming: Set<Capability> = new Set(["tools", "streaming"]);

/** Models Foreman is tested against. Unknown models fail startup validation. */
export const MODEL_CAPABILITIES: Record<string, Set<Capability>> = {
  // Anthropic
  "anthropic/claude-sonnet-4-6": tools_streaming,
  "anthropic/claude-haiku-4-5-20251001": tools_streaming,
  "anthropic/claude-haiku-4-5": tools_streaming,
  "anthropic/claude-opus-4-6": tools_streaming,

  // OpenAI
  "openai/gpt-4o": tools_streaming,
  "openai/gpt-4o-mini": tools_streaming,
  "openai/gpt-4-turbo": tools_streaming,
  "openai/gpt-4.1": tools_streaming,
  "openai/gpt-4.1-mini": tools_streaming,

  // Google
  "google/gemini-2.5-flash": tools_streaming,
  "google/gemini-2.5-pro": tools_streaming,
  "google/gemini-2.0-flash": tools_streaming,
  "google/gemini-1.5-pro": tools_streaming,
};

/** Capabilities each agent requires. Checked against configured model at boot. */
export const AGENT_REQUIREMENTS: Record<AgentName, Capability[]> = {
  foreman: ["tools", "streaming"],
  discovery: ["tools"],
  execution: ["tools", "streaming"],
  supervisor: ["tools"],
  history: ["tools"],
};
