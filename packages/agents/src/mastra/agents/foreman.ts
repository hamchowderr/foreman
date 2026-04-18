import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { discoverConnectionsTool } from "../tools/discover-connections";
import { listActionsTool } from "../tools/list-actions";
import { getActionSchemaTool } from "../tools/get-action-schema";
import { getFieldChoicesTool } from "../tools/get-field-choices";
import { executeActionTool } from "../tools/execute-action";
import { rawApiCallTool } from "../tools/raw-api-call";

const SYSTEM_PROMPT = `You are Foreman, an AI assistant that helps the user take actions across 9000+ apps via Zapier. Use discovery tools (discover_connections, list_actions, get_action_schema, get_field_choices) freely to understand what the user has connected and what is possible. Before calling execute_action, you must first call get_action_schema and fill in the inputs based on user intent. For any input field that has enumerated choices (dropdown-style), call get_field_choices rather than guessing values. Never call raw_api_call unless no pre-built action can accomplish the goal; always prefer pre-built actions. When proposing an action for approval, describe it in one plain-English sentence that will become the human_label shown to the user.`;

export function createForemanAgent(databaseUrl: string) {
  return new Agent({
    id: "foreman",
    name: "Foreman",
    description:
      "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: SYSTEM_PROMPT,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: {
      discover_connections: discoverConnectionsTool,
      list_actions: listActionsTool,
      get_action_schema: getActionSchemaTool,
      get_field_choices: getFieldChoicesTool,
      execute_action: executeActionTool,
      raw_api_call: rawApiCallTool,
    },
    memory: new Memory({
      storage: new LibSQLStore({
        id: "foreman-memory",
        url: databaseUrl,
      }),
      vector: new LibSQLVector({
        id: "foreman-memory-vector",
        url: databaseUrl,
      }),
      embedder: "openai/text-embedding-3-small",
      options: {
        lastMessages: 20,
        workingMemory: { enabled: true },
        semanticRecall: {
          topK: 4,
          messageRange: 2,
        },
        observationalMemory: true,
      },
    }),
  });
}
