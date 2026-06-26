import { Agent } from "@mastra/core/agent";
import {
  AGENT_MODELS,
  modelSettingsFor,
  onFinishCostLogger,
  systemPromptFor,
  toolsWithCacheControl,
} from "../../lib/providers";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";

const DISCOVERY_PROMPT = `You are the Discovery Agent, a specialist in exploring Zapier integrations. Your job is to help users discover what apps they have connected, what actions are available, and what inputs those actions require.

When asked about available integrations:
1. Use list-connections or find-first-connection to see what apps the user has connected.
2. Use list-actions to find available actions for a specific app.
3. Use get-action-input-fields-schema to get the input schema for a specific action.
4. For any field with enumerated choices, use list-action-input-field-choices to get the valid options.
5. Use list-apps with the search parameter to find apps by name.

Return structured, concise results. Do not execute actions — only discover and describe them.`;

const DISCOVERY_TOOL_NAMES = [
  "list-connections",
  "find-first-connection",
  "list-actions",
  "get-action",
  "get-action-input-fields-schema",
  "list-action-input-field-choices",
  "list-apps",
  "get-app",
];

// Resolved lazily via DynamicArgument so createZapierSdk() runs after new Mastra().
// See zapier-sdk-tools.ts for why module-load SDK init breaks Mastra Studio.
let _discoveryToolsCache: Record<string, any> | undefined;

function buildDiscoveryTools() {
  if (_discoveryToolsCache) return _discoveryToolsCache;
  let allTools: Record<string, any> = {};
  try {
    allTools = generateZapierTools();
  } catch (err) {
    console.error("[discovery] generateZapierTools failed; agent will have no tools:", err);
  }
  const filtered: Record<string, any> = {};
  for (const name of DISCOVERY_TOOL_NAMES) {
    if (allTools[name]) filtered[name] = allTools[name];
  }
  _discoveryToolsCache = toolsWithCacheControl("discovery", filtered);
  return _discoveryToolsCache;
}

export function createDiscoveryAgent() {
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
    tools: () => buildDiscoveryTools(),
  });
}
