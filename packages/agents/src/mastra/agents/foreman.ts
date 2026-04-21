import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem, LocalSandbox } from "@mastra/core/workspace";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
} from "@mastra/evals/scorers/prebuilt";
import { ToolSearchProcessor } from "@mastra/core/processors";
import { contextInjector, piiRedactor } from "../../lib/processors";
import {
  buildSystemPrompt,
  type PromptContext,
} from "../../lib/prompt-template";
import { OpenAIVoice } from "@mastra/voice-openai";
import { searchHistoryTool } from "../tools/search-history";
import { forkConversationTool } from "../tools/fork-conversation";
import { connectZapierTool } from "../tools/connect-zapier";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";

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

// Shared SDK tools — generated once at startup, reused across agent calls.
// No child process, no MCP transport — direct library import.
let _sdkTools: Record<string, any> | undefined;
function getZapierTools() {
  if (!_sdkTools) _sdkTools = generateZapierTools();
  return _sdkTools;
}

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

  // Generate all 34 Zapier tools directly from SDK registry.
  // No MCP, no child process — pure library import.
  // toModelOutput and requireApproval are baked into each tool.
  const sdkTools = getZapierTools();

  // Use ToolSearchProcessor for SDK tools — with 34 tools, loading all schemas
  // into context every call wastes tokens. The agent gets search_tools and
  // load_tool meta-tools to discover and load only what it needs per request.
  const zapierToolSearch = new ToolSearchProcessor({
    tools: sdkTools,
    search: { topK: 8, minScore: 0.1 },
  });

  return new Agent({
    id: "foreman",
    name: "Foreman",
    description:
      "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: buildSystemPrompt(),
    model: MODELS.default,
    tools: {
      // Custom tools always available (not behind search)
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
    inputProcessors: [contextInjector, zapierToolSearch],
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
        generateTitle: {
          model: MODELS.fast,
          instructions: "Generate a concise 3-6 word title for this conversation.",
        },
        workingMemory: { enabled: true },
        semanticRecall: {
          topK: 2,
          messageRange: 1,
          scope: "resource",
        },
        observationalMemory: true,
      },
    }),
  });
}
