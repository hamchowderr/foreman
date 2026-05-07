import { Agent } from "@mastra/core/agent";
import { AGENT_MODELS, modelSettingsFor, onFinishCostLogger, systemPromptFor, toolsWithCacheControl } from "../../lib/providers";
import { getDefaultZapierTools } from "../../lib/zapier-sdk-tools";

const DISCOVERY_PROMPT = `You are the Discovery Agent, a specialist in exploring Zapier integrations. Your job is to help users discover what apps they have connected, what actions are available, and what inputs those actions require.

When asked about available integrations:
1. Use list-connections or find-first-connection to see what apps the user has connected.
2. Use list-actions to find available actions for a specific app.
3. Use get-input-fields-schema to get the input schema for a specific action.
4. For any field with enumerated choices, use list-input-field-choices to get the valid options.
5. Use list-apps with the search parameter to find apps by name.

Return structured, concise results. Do not execute actions — only discover and describe them.`;

let _discoveryTools: Record<string, any> | undefined;

export function createDiscoveryAgent() {
  if (!_discoveryTools) {
    const allTools = getDefaultZapierTools();
    const discoveryToolNames = [
      "list-connections",
      "find-first-connection",
      "list-actions",
      "get-action",
      "get-input-fields-schema",
      "list-input-fields",
      "list-input-field-choices",
      "list-apps",
      "get-app",
    ];
    _discoveryTools = {};
    for (const name of discoveryToolNames) {
      if (allTools[name]) _discoveryTools[name] = allTools[name];
    }
  }

  return new Agent({
    id: "discovery",
    name: "Discovery Agent",
    description:
      "Explores Zapier integrations — discovers connected apps, lists available actions, retrieves action schemas and field choices. Use this agent for any question about what apps or actions are available.",
    instructions: systemPromptFor("discovery", DISCOVERY_PROMPT),
    model: AGENT_MODELS.discovery,
    defaultOptions: {
      modelSettings: modelSettingsFor("discovery"),
      onFinish: onFinishCostLogger("discovery"),
    },
    tools: toolsWithCacheControl("discovery", _discoveryTools),
  });
}
