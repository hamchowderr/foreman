import { Agent } from "@mastra/core/agent";
import { discoverConnectionsTool } from "../tools/discover-connections";
import { listActionsTool } from "../tools/list-actions";
import { getActionSchemaTool } from "../tools/get-action-schema";
import { getFieldChoicesTool } from "../tools/get-field-choices";
import { MODELS } from "./foreman";

const DISCOVERY_PROMPT = `You are the Discovery Agent, a specialist in exploring Zapier integrations. Your job is to help users discover what apps they have connected, what actions are available, and what inputs those actions require.

When asked about available integrations:
1. Use discover_connections to see what apps the user has connected.
2. Use list_actions to find available actions for a specific app.
3. Use get_action_schema to get the input schema for a specific action.
4. For any field with enumerated choices, use get_field_choices to get the valid options.

Return structured, concise results. Do not execute actions — only discover and describe them.`;

export function createDiscoveryAgent() {
  return new Agent({
    id: "discovery",
    name: "Discovery Agent",
    description:
      "Explores Zapier integrations — discovers connected apps, lists available actions, retrieves action schemas and field choices. Use this agent for any question about what apps or actions are available.",
    instructions: DISCOVERY_PROMPT,
    model: MODELS.fast,
    tools: {
      discover_connections: discoverConnectionsTool,
      list_actions: listActionsTool,
      get_action_schema: getActionSchemaTool,
      get_field_choices: getFieldChoicesTool,
    },
  });
}
