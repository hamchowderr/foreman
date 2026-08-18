import { Agent } from "@mastra/core/agent";
import {
  AGENT_MODELS,
  modelSettingsFor,
  onFinishCostLogger,
  systemPromptFor,
  toolsWithCacheControl,
} from "../../lib/providers";
import { searchHistoryTool } from "../tools/search-history";
import { piiRedactor } from "../../lib/processors";

const HISTORY_PROMPT = `You are the History Agent, a specialist in searching and analyzing a user's past action history. You help users recall previous actions, find patterns in their usage, and recommend actions based on what they have done before.

When asked about past actions:
1. Use search_history with a natural language query to find relevant past actions.
2. Summarize results clearly — include action names, apps involved, and when they occurred.
3. Highlight patterns or suggest related actions the user might want to repeat.

You only search and report — you do not execute actions.`;

export function createHistoryAgent() {
  return new Agent({
    id: "history",
    name: "History Agent",
    description:
      "Searches and analyzes the user's past Zapier action history. Use this agent to recall previous actions, find usage patterns, or get recommendations based on history.",
    instructions: systemPromptFor("history", HISTORY_PROMPT),
    model: AGENT_MODELS.history,
    defaultOptions: {
      modelSettings: modelSettingsFor("history"),
      onFinish: onFinishCostLogger("history"),
    },
    outputProcessors: [piiRedactor],
    tools: toolsWithCacheControl("history", {
      search_history: searchHistoryTool,
    }),
  });
}
