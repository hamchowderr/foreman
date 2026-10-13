import type { AgentControllerSubagent } from "@mastra/core/agent-controller";
import { AGENT_MODELS, primary, systemPromptFor } from "../../lib/providers";
import { buildDiscoveryTools, DISCOVERY_PROMPT } from "../agents/discovery";
import { HISTORY_PROMPT } from "../agents/history";
import { searchHistoryTool } from "../tools/search-history";

/**
 * Subagents the Foreman AgentController can hand work to through its built-in
 * `subagent` tool. Each runs as a fresh Agent with the run's request context (so
 * Zapier calls act as the signed-in user), and the chat kit shows its steps live.
 *
 * Only the READ-ONLY specialists are subagents. A subagent run streams with
 * `requireToolApproval: false` and has no approval card of its own, so Zapier writes
 * (the execution agent's run-action / fetch) stay with the main agent, where the
 * approval card always shows.
 */

export const FOREMAN_SUBAGENTS: AgentControllerSubagent[] = [
  {
    id: "discovery",
    name: "Discovery",
    description:
      "Explores the user's Zapier setup: which apps are connected, which actions an app offers, and the input fields (and field choices) an action needs. Read-only.",
    instructions: systemPromptFor("discovery", DISCOVERY_PROMPT),
    // A getter: the Zapier tools need the SDK, which must not be created before
    // new Mastra() (see zapier-sdk-tools.ts). The controller reads this on each run.
    get tools() {
      return buildDiscoveryTools();
    },
    defaultModelId: primary(AGENT_MODELS.discovery),
    allowedWorkspaceTools: [],
  },
  {
    id: "history",
    name: "History",
    description:
      "Searches the user's past Zapier actions to recall what was done, spot patterns, or suggest repeating something. Read-only.",
    instructions: systemPromptFor("history", HISTORY_PROMPT),
    tools: { search_history: searchHistoryTool },
    defaultModelId: primary(AGENT_MODELS.history),
    allowedWorkspaceTools: [],
  },
];
