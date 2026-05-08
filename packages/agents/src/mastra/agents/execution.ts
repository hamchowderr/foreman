import { Agent } from "@mastra/core/agent";
import { connectZapierTool } from "../tools/connect-zapier";
import { AGENT_MODELS, modelSettingsFor, onFinishCostLogger, systemPromptFor, toolsWithCacheControl } from "../../lib/providers";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";

const EXECUTION_PROMPT = `You are the Execution Agent, responsible for running Zapier actions on behalf of users. You handle action execution, raw API calls, and Zapier account connections.

Guidelines:
- Use run-action to execute actions. Always prefer this over raw HTTP calls.
- Only use fetch or request when no pre-built action can accomplish the goal.
- When executing, describe clearly what the action will do.
- If the user is not connected to Zapier, use connect_zapier to generate a connection URL.
- You will receive pre-resolved action schemas and inputs from the supervisor. Do not re-discover — just execute.`;

const EXECUTION_TOOL_NAMES = ["run-action", "fetch"];

// Resolved lazily via DynamicArgument so createZapierSdk() runs after new Mastra().
// See zapier-sdk-tools.ts for why module-load SDK init breaks Mastra Studio.
let _executionToolsCache: Record<string, any> | undefined;

function buildExecutionTools() {
  if (_executionToolsCache) return _executionToolsCache;
  const allTools = generateZapierTools();
  const filtered: Record<string, any> = {};
  for (const name of EXECUTION_TOOL_NAMES) {
    if (allTools[name]) filtered[name] = allTools[name];
  }
  _executionToolsCache = toolsWithCacheControl("execution", {
    ...filtered,
    connect_zapier: connectZapierTool,
  });
  return _executionToolsCache;
}

export function createExecutionAgent() {
  return new Agent({
    id: "execution",
    name: "Execution Agent",
    description:
      "Executes Zapier actions, makes raw API calls, and manages Zapier account connections. Use this agent when you need to run an action, make an API request, or connect a user to Zapier.",
    instructions: systemPromptFor("execution", EXECUTION_PROMPT),
    model: AGENT_MODELS.execution,
    defaultOptions: {
      modelSettings: modelSettingsFor("execution"),
      onFinish: onFinishCostLogger("execution"),
    },
    tools: () => buildExecutionTools(),
  });
}
