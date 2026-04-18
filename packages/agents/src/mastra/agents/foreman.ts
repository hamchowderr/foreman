import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem, LocalSandbox } from "@mastra/core/workspace";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
} from "@mastra/evals/scorers/prebuilt";
import { contextInjector, piiRedactor } from "../../lib/processors";
import {
  buildSystemPrompt,
  type PromptContext,
} from "../../lib/prompt-template";
import { OpenAIVoice } from "@mastra/voice-openai";
import { discoverConnectionsTool } from "../tools/discover-connections";
import { listActionsTool } from "../tools/list-actions";
import { getActionSchemaTool } from "../tools/get-action-schema";
import { getFieldChoicesTool } from "../tools/get-field-choices";
import { executeActionTool } from "../tools/execute-action";
import { rawApiCallTool } from "../tools/raw-api-call";
import { searchHistoryTool } from "../tools/search-history";
import { forkConversationTool } from "../tools/fork-conversation";

/** Model routing constants — use the right model for the job */
export const MODELS = {
  /** Default model for conversation and execution approval */
  default: "anthropic/claude-sonnet-4-6",
  /** Fast/cheap model for title generation, scoring, lightweight tasks */
  fast: "anthropic/claude-haiku-4-5-20251001",
  /** Heavy reasoning for complex multi-step planning */
  heavy: "anthropic/claude-opus-4-6",
} as const;

export { buildSystemPrompt, type PromptContext };

export function createForemanAgent(databaseUrl: string) {
  const workspacePath = "./data/workspace";

  const workspace = new Workspace({
    id: "foreman-workspace",
    name: "Foreman Workspace",
    filesystem: new LocalFilesystem({
      basePath: workspacePath,
      contained: true,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: workspacePath,
    }),
    bm25: true,
    tools: {
      mastra_workspace_write_file: { requireApproval: true },
      mastra_workspace_edit_file: { requireApproval: true },
      mastra_workspace_delete: { requireApproval: true },
      mastra_workspace_execute_command: { requireApproval: true },
    },
  });

  return new Agent({
    id: "foreman",
    name: "Foreman",
    description:
      "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: buildSystemPrompt(),
    model: MODELS.default,
    tools: {
      discover_connections: discoverConnectionsTool,
      list_actions: listActionsTool,
      get_action_schema: getActionSchemaTool,
      get_field_choices: getFieldChoicesTool,
      execute_action: executeActionTool,
      raw_api_call: rawApiCallTool,
      search_history: searchHistoryTool,
      fork_conversation: forkConversationTool,
    },
    voice: new OpenAIVoice(),
    scorers: {
      relevancy: {
        scorer: createAnswerRelevancyScorer({ model: MODELS.fast }),
        sampling: { type: "ratio", rate: 0.3 },
      },
      toxicity: {
        scorer: createToxicityScorer({ model: MODELS.fast }),
        sampling: { type: "ratio", rate: 0.2 },
      },
    },
    inputProcessors: [contextInjector],
    outputProcessors: [piiRedactor],
    workspace,
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
