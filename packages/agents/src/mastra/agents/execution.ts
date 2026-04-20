import { Agent } from "@mastra/core/agent";
import { connectZapierTool } from "../tools/connect-zapier";
import { MODELS } from "./foreman";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";

const EXECUTION_PROMPT = `You are the Execution Agent, responsible for running Zapier actions on behalf of users. You handle action execution, raw API calls, and Zapier account connections.

Guidelines:
- Use run-action to execute actions. Always prefer this over raw HTTP calls.
- Only use fetch or request when no pre-built action can accomplish the goal.
- When executing, describe clearly what the action will do.
- If the user is not connected to Zapier, use connect_zapier to generate a connection URL.
- You will receive pre-resolved action schemas and inputs from the supervisor. Do not re-discover — just execute.`;

let _executionTools: Record<string, any> | undefined;

export function createExecutionAgent() {
  if (!_executionTools) {
    const allTools = generateZapierTools();
    const executionToolNames = [
      "run-action",
      "fetch",
      "request",
    ];
    _executionTools = {};
    for (const name of executionToolNames) {
      if (allTools[name]) _executionTools[name] = allTools[name];
    }
  }

  return new Agent({
    id: "execution",
    name: "Execution Agent",
    description:
      "Executes Zapier actions, makes raw API calls, and manages Zapier account connections. Use this agent when you need to run an action, make an API request, or connect a user to Zapier.",
    instructions: EXECUTION_PROMPT,
    model: MODELS.default,
    tools: {
      ...(_executionTools ?? {}),
      connect_zapier: connectZapierTool,
    },
  });
}
