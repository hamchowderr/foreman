import { Agent } from "@mastra/core/agent";
import { executeActionTool } from "../tools/execute-action";
import { rawApiCallTool } from "../tools/raw-api-call";
import { connectZapierTool } from "../tools/connect-zapier";
import { MODELS } from "./foreman";

const EXECUTION_PROMPT = `You are the Execution Agent, responsible for running Zapier actions on behalf of users. You handle action execution, raw API calls, and Zapier account connections.

Guidelines:
- execute_action and raw_api_call both require user approval (requireApproval is set).
- Always prefer execute_action with a pre-built action over raw_api_call.
- Only use raw_api_call when no pre-built action can accomplish the goal.
- When executing, provide a clear humanLabel describing what the action will do.
- If the user is not connected to Zapier, use connect_zapier to generate a connection URL.
- You will receive pre-resolved action schemas and inputs from the supervisor. Do not re-discover — just execute.`;

export function createExecutionAgent() {
  return new Agent({
    id: "execution",
    name: "Execution Agent",
    description:
      "Executes Zapier actions, makes raw API calls, and manages Zapier account connections. Use this agent when you need to run an action, make an API request, or connect a user to Zapier.",
    instructions: EXECUTION_PROMPT,
    model: MODELS.default,
    tools: {
      execute_action: executeActionTool,
      raw_api_call: rawApiCallTool,
      connect_zapier: connectZapierTool,
    },
  });
}
