/**
 * Per-agent generation parameters (temperature, maxOutputTokens, topP).
 *
 * Resolved at module-load time from env. Unset values are omitted from the
 * returned settings object so Mastra's and the provider's own defaults apply.
 *
 * Env var names follow the `<AGENT>_<PARAM>` pattern:
 *   FOREMAN_TEMPERATURE, FOREMAN_MAX_OUTPUT_TOKENS, FOREMAN_TOP_P
 *   DISCOVERY_TEMPERATURE, DISCOVERY_MAX_OUTPUT_TOKENS, DISCOVERY_TOP_P
 *   ... and the same for EXECUTION, SUPERVISOR, HISTORY.
 *
 * The property names match AI SDK's CallSettings (maxOutputTokens, not
 * maxTokens) — that's the field Mastra forwards on the wire.
 */

import type { AgentName } from "./models";

export interface AgentParams {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
}

function parseNumEnv(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function readParams(prefix: string): AgentParams {
  return {
    temperature: parseNumEnv(process.env[`${prefix}_TEMPERATURE`]),
    maxOutputTokens: parseNumEnv(process.env[`${prefix}_MAX_OUTPUT_TOKENS`]),
    topP: parseNumEnv(process.env[`${prefix}_TOP_P`]),
  };
}

export const AGENT_PARAMS: Record<AgentName, AgentParams> = {
  foreman: readParams("FOREMAN"),
  discovery: readParams("DISCOVERY"),
  execution: readParams("EXECUTION"),
  supervisor: readParams("SUPERVISOR"),
  history: readParams("HISTORY"),
  digest: readParams("DIGEST"),
};

/**
 * Build a Mastra `modelSettings` object for an agent, omitting unset fields.
 * Returns `undefined` when the agent has no params configured so callers can
 * skip setting `defaultOptions` entirely.
 */
export function modelSettingsFor(agent: AgentName): AgentParams | undefined {
  const p = AGENT_PARAMS[agent];
  const out: AgentParams = {};
  if (p.temperature !== undefined) out.temperature = p.temperature;
  if (p.maxOutputTokens !== undefined) out.maxOutputTokens = p.maxOutputTokens;
  if (p.topP !== undefined) out.topP = p.topP;
  return Object.keys(out).length > 0 ? out : undefined;
}
