import { Agent } from "@mastra/core/agent";
import { ToolSearchProcessor } from "@mastra/core/processors";
import { LocalFilesystem, LocalSandbox, Workspace } from "@mastra/core/workspace";
import { createAnswerRelevancyScorer, createToxicityScorer } from "@mastra/evals/scorers/prebuilt";
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";
import { OpenAIVoice } from "@mastra/voice-openai";
import { stepCountIs } from "ai";
import { contextInjector, piiRedactor } from "../../lib/processors";
import { buildSystemPrompt, type PromptContext } from "../../lib/prompt-template";
import {
  AGENT_MODELS,
  MODELS,
  modelSettingsFor,
  onFinishCostLogger,
  systemPromptFor,
  toolsWithCacheControl,
} from "../../lib/providers";
import { sanitizeToolSchemas } from "../../lib/tool-schema-sanitizer";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";
import { channelTriggerProvider } from "../signals/channel-trigger-provider";
import { zapierPollProvider } from "../signals/zapier-poll-provider";
import { attachTriggerTool } from "../tools/attach-trigger";
import { connectZapierTool } from "../tools/connect-zapier";
import { createDashboardTool } from "../tools/create-dashboard";
import { deleteWorkflowTool } from "../tools/delete-workflow";
import { detachTriggerTool } from "../tools/detach-trigger";
import { forkConversationTool } from "../tools/fork-conversation";
import { getWorkflowTool } from "../tools/get-workflow";
import { listWorkflowTriggersTool } from "../tools/list-workflow-triggers";
import { listWorkflowsTool } from "../tools/list-workflows";
import { runWorkflowTool } from "../tools/run-workflow";
import { saveWorkflowTool } from "../tools/save-workflow";
import { searchHistoryTool } from "../tools/search-history";
import { updateWorkflowTool } from "../tools/update-workflow";

export { buildSystemPrompt, type PromptContext };

// Core tools the agent needs for every action — always loaded, no search required.
// This avoids wasting steps on search_tools + load_tool for common operations.
// Includes Zapier Tables management (these are SDK-level operations, NOT
// run-action calls — having them direct prevents the agent from hallucinating
// `run-action` invocations like `create_fields` that don't exist as actions).
const CORE_TOOL_NAMES = [
  // App discovery (so the agent doesn't need search_tools to translate
  // "Notion" → "notion" slug or fetch app metadata)
  "list-apps",
  "get-app",
  // Connection discovery
  "list-connections",
  "find-first-connection",
  "find-unique-connection",
  // Action discovery + execution
  "list-actions",
  "get-action",
  "get-input-fields-schema",
  "list-input-field-choices",
  "run-action",
  // Zapier Tables (SDK-level, not run-action)
  "list-tables",
  "get-table",
  "create-table",
  "delete-table",
  "list-table-fields",
  "create-table-fields",
  "delete-table-fields",
  "list-table-records",
  "get-table-record",
  "create-table-records",
  "update-table-records",
  "delete-table-records",
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
  // SDK init can throw (network, credentials, registry build). When it does,
  // returning the custom-only tool set is honest: the agent keeps the Foreman
  // tools (connect_zapier etc.) so it can still tell the user what failed
  // instead of cascading into 8+ "Error calling handler" log entries from
  // every Studio listTools probe.
  let sdkTools: Record<string, any> = {};
  try {
    sdkTools = generateZapierTools();
  } catch (err) {
    console.error("[foreman] generateZapierTools failed; serving custom tools only:", err);
  }
  const coreTools: Record<string, any> = {};
  for (const name of CORE_TOOL_NAMES) {
    if (sdkTools[name]) coreTools[name] = sdkTools[name];
  }
  _foremanToolsCache = sanitizeToolSchemas(
    toolsWithCacheControl("foreman", {
      search_history: searchHistoryTool,
      fork_conversation: forkConversationTool,
      connect_zapier: connectZapierTool,
      create_dashboard: createDashboardTool,
      save_workflow: saveWorkflowTool,
      list_workflows: listWorkflowsTool,
      get_workflow: getWorkflowTool,
      run_workflow: runWorkflowTool,
      update_workflow: updateWorkflowTool,
      delete_workflow: deleteWorkflowTool,
      attach_trigger: attachTriggerTool,
      list_workflow_triggers: listWorkflowTriggersTool,
      detach_trigger: detachTriggerTool,
      ...coreTools,
    }),
  );
  return _foremanToolsCache;
}

function buildForemanInputProcessors() {
  if (_foremanProcessorsCache) return _foremanProcessorsCache;
  let sdkTools: Record<string, any> = {};
  try {
    sdkTools = generateZapierTools();
  } catch (err) {
    console.error(
      "[foreman] generateZapierTools failed in inputProcessors; ToolSearchProcessor will index nothing:",
      err,
    );
  }
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
    description: "AI assistant that helps users take actions across 9000+ apps via Zapier",
    instructions: systemPromptFor("foreman", buildSystemPrompt()),
    model: AGENT_MODELS.foreman,
    defaultOptions: {
      modelSettings: modelSettingsFor("foreman"),
      onFinish: onFinishCostLogger("foreman"),
      // Raise the agent loop ceiling — the previous default (15 steps) caused
      // multi-tool flows (Tables: search → load → list-actions → get-schema →
      // run-action → fields setup → records insert) to silently truncate
      // mid-stream with no closing message to the user.
      stopWhen: stepCountIs(40),
    },
    tools: () => buildForemanTools(),
    // Triggers run as Mastra SignalProviders hosted on this agent (agent-hosted
    // gives them notify() → events land in the user's thread). Neither sets a
    // pollInterval: the poll provider is driven by cron-driver-server on a
    // single tick (so it doesn't auto-poll in every process the agent is built
    // in); the channel provider is event-driven via the webhook handlers.
    signals: [zapierPollProvider, channelTriggerProvider],
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
        // observationalMemory removed: its input processor requires a threadId
        // in RequestContext, which Mastra's experiment runner doesn't inject.
        // workingMemory + lastMessages + semanticRecall provide sufficient
        // memory for production conversational use.
        observationalMemory: false,
      },
    }),
  });
}
