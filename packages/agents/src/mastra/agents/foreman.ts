import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem, LocalSandbox } from "@mastra/core/workspace";
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";
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
import {
  MODELS,
  AGENT_MODELS,
  modelSettingsFor,
  onFinishCostLogger,
  systemPromptFor,
  toolsWithCacheControl,
} from "../../lib/providers";

export { buildSystemPrompt, type PromptContext };

// Core tools the agent needs for every action — always loaded, no search required.
// This avoids wasting steps on search_tools + load_tool for common operations.
const CORE_TOOL_NAMES = [
  "list-connections",
  "find-first-connection",
  "list-actions",
  "get-action",
  "get-input-fields-schema",
  "list-input-field-choices",
  "run-action",
];

/**
 * Lazy resolution of Zapier-derived configuration.
 *
 * `createZapierSdk()` mutates global zod state and must run AFTER
 * `new Mastra(...)` has constructed — otherwise Mastra Studio's
 * `toJSONSchema` introspection hangs instead of throwing. By keeping these
 * caches behind functions invoked from the agent's `tools` / `inputProcessors`
 * `DynamicArgument` callbacks, the SDK call is deferred to the first request,
 * which always lands after Mastra finishes wiring up.
 */
let _foremanToolsCache: Record<string, any> | undefined;
let _foremanProcessorsCache: any[] | undefined;

function buildForemanTools() {
  if (_foremanToolsCache) return _foremanToolsCache;
  const sdkTools = generateZapierTools();
  const coreTools: Record<string, any> = {};
  for (const name of CORE_TOOL_NAMES) {
    if (sdkTools[name]) coreTools[name] = sdkTools[name];
  }
  _foremanToolsCache = toolsWithCacheControl("foreman", {
    search_history: searchHistoryTool,
    fork_conversation: forkConversationTool,
    connect_zapier: connectZapierTool,
    ...coreTools,
  });
  return _foremanToolsCache;
}

function buildForemanInputProcessors() {
  if (_foremanProcessorsCache) return _foremanProcessorsCache;
  const sdkTools = generateZapierTools();
  const searchableTools: Record<string, any> = {};
  for (const [name, tool] of Object.entries(sdkTools)) {
    if (!CORE_TOOL_NAMES.includes(name)) searchableTools[name] = tool;
  }
  // Only put non-core tools behind search (tables, fetch, app listing, etc.)
  const zapierToolSearch = new ToolSearchProcessor({
    tools: searchableTools,
    search: { topK: 8, minScore: 0.1 },
  });
  _foremanProcessorsCache = [contextInjector, zapierToolSearch];
  return _foremanProcessorsCache;
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

  return new Agent({
    id: "foreman",
    name: "Foreman",
    description:
      "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: systemPromptFor("foreman", buildSystemPrompt()),
    model: AGENT_MODELS.foreman,
    defaultOptions: {
      modelSettings: modelSettingsFor("foreman"),
      onFinish: onFinishCostLogger("foreman"),
    },
    tools: () => buildForemanTools(),
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
    inputProcessors: () => buildForemanInputProcessors(),
    outputProcessors: [piiRedactor],
    workspace,
    memory: new Memory({
      storage: new PostgresStore({
        id: "foreman-memory",
        connectionString: databaseUrl,
      }),
      vector: new PgVector({
        id: "foreman-memory-vector",
        connectionString: databaseUrl,
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
