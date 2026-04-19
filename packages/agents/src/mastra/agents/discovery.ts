import { Agent } from "@mastra/core/agent";
import {
  AGENT_MODELS,
  modelSettingsFor,
  systemPromptFor,
} from "../../lib/providers";
import { createZapierMCPClient } from "../../lib/zapier-mcp";

const DISCOVERY_PROMPT = `You are the Discovery Agent, a specialist in exploring Zapier integrations. Your job is to help users discover what apps they have connected, what actions are available, and what inputs those actions require.

When asked about available integrations:
1. Use list-connections or find-first-connection to see what apps the user has connected.
2. Use list-actions to find available actions for a specific app.
3. Use get-input-fields-schema to get the input schema for a specific action.
4. For any field with enumerated choices, use list-input-field-choices to get the valid options.
5. Use list-apps with the search parameter to find apps by name.

Return structured, concise results. Do not execute actions — only discover and describe them.`;

let _mcpTools: Record<string, any> | undefined;

export async function createDiscoveryAgent() {
  if (!_mcpTools) {
    const mcp = createZapierMCPClient();
    const allTools = await mcp.listTools();
    // Only include discovery-related MCP tools
    const discoveryToolNames = [
      "zapier_list-connections",
      "zapier_find-first-connection",
      "zapier_list-actions",
      "zapier_get-action",
      "zapier_get-input-fields-schema",
      "zapier_list-input-fields",
      "zapier_list-input-field-choices",
      "zapier_list-apps",
      "zapier_get-app",
    ];
    _mcpTools = {};
    for (const name of discoveryToolNames) {
      if (allTools[name]) _mcpTools[name] = allTools[name];
    }
  }

  return new Agent({
    id: "discovery",
    name: "Discovery Agent",
    description:
      "Explores Zapier integrations — discovers connected apps, lists available actions, retrieves action schemas and field choices. Use this agent for any question about what apps or actions are available.",
    instructions: systemPromptFor("discovery", DISCOVERY_PROMPT),
    model: AGENT_MODELS.discovery,
    defaultOptions: { modelSettings: modelSettingsFor("discovery") },
    tools: _mcpTools,
  });
}
