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
import { searchHistoryTool } from "../tools/search-history";
import { forkConversationTool } from "../tools/fork-conversation";
import { connectZapierTool } from "../tools/connect-zapier";
import { createZapierMCPClient, addModelOutputTransformers } from "../../lib/zapier-mcp";

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

// Shared MCP client — initialized once, reused across agent calls
let _zapierMcp: ReturnType<typeof createZapierMCPClient> | undefined;
function getZapierMcp() {
  if (!_zapierMcp) _zapierMcp = createZapierMCPClient();
  return _zapierMcp;
}

export async function createForemanAgent(databaseUrl: string) {
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

  // Get all tools from Zapier SDK MCP server (replaces 13 custom tools)
  // toModelOutput transformers reduce verbose API responses before they hit the model
  const zapierMcp = getZapierMcp();
  const mcpTools = addModelOutputTransformers(await zapierMcp.listTools());

  return new Agent({
    id: "foreman",
    name: "Foreman",
    description:
      "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: buildSystemPrompt(),
    model: MODELS.default,
    tools: {
      // MCP tools from Zapier SDK (actions, apps, connections, tables, HTTP)
      ...mcpTools,
      // Custom tools not covered by MCP
      search_history: searchHistoryTool,
      fork_conversation: forkConversationTool,
      connect_zapier: connectZapierTool,
    },
    voice: process.env.OPENAI_API_KEY ? new OpenAIVoice() : undefined,
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
          topK: 2,
          messageRange: 1,
          scope: "resource", // Cross-thread recall for user preferences, but limited to reduce noise
        },
        observationalMemory: true,
      },
    }),
  });
}
