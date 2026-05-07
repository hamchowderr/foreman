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
};

export function modelSettingsFor(agent: AgentName): AgentParams | undefined {
  const p = AGENT_PARAMS[agent];
  const out: AgentParams = {};
  if (p.temperature !== undefined) out.temperature = p.temperature;
  if (p.maxOutputTokens !== undefined) out.maxOutputTokens = p.maxOutputTokens;
  if (p.topP !== undefined) out.topP = p.topP;
  return Object.keys(out).length > 0 ? out : undefined;
}
