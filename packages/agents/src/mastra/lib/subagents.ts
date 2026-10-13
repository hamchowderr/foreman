import type { ToolsInput } from "@mastra/core/agent";
import type { AgentControllerSubagent } from "@mastra/core/agent-controller";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getManagementForUser, inspectForUser, listForUser } from "../../lib/automations/service";
import { AGENT_MODELS, primary, systemPromptFor } from "../../lib/providers";
import { resolveRequestUserId } from "../../lib/request-user-context";
import { generateZapierTools } from "../../lib/zapier-sdk-tools";
import { buildDiscoveryTools, DISCOVERY_PROMPT } from "../agents/discovery";
import { HISTORY_PROMPT } from "../agents/history";
import { searchHistoryTool } from "../tools/search-history";
import { listStoredFilesTool, readStoredFileTool, statStoredFileTool } from "../tools/stored-files";

/**
 * Subagents the Foreman AgentController can hand work to through its built-in
 * `subagent` tool. Each runs as a fresh Agent with the run's request context (so
 * Zapier calls act as the signed-in user), and the chat kit shows its steps live.
 *
 * Only the READ-ONLY specialists are subagents. A subagent run streams with
 * `requireToolApproval: false` and has no approval card of its own, so Zapier writes
 * (the execution agent's run-action / fetch) stay with the main agent, where the
 * approval card always shows. The same goes for the Files, Automations and Tables
 * specialists: they get the read tools of their surface and nothing that changes it.
 */

const ZAPIER_LOOKUP_SUBAGENTS: AgentControllerSubagent[] = [
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

export const FILES_PROMPT = `You are the Files Agent. You browse and read the user's stored files in Zapier (their virtual file system): list folders, read files, and check a file's size and dates.

1. Use list_stored_files to see what is in a folder (start at "/" when no path is given).
2. Use stat_stored_file to check that a path exists and how big it is before reading a large file.
3. Use read_stored_file to read a file, and quote or summarize what the task asks for.

You only read. You never write, move, copy or delete files; say so if the task asks for that.`;

export const AUTOMATIONS_PROMPT = `You are the Automations Agent. You report on the user's durable Zapier automations in their current workspace: what exists, whether each is enabled, how recent runs went, and how agentic management is set up.

1. Use list_automations to find automations (match the one the task names).
2. Use inspect_automation for one automation's definition, trigger and recent runs. Point out failed runs and their errors.
3. Use get_automation_management for its heal / expand / harden settings.

You only read. You never create, run, test or change automations; say so if the task asks for that.`;

export const TABLES_PROMPT = `You are the Tables Agent. You look up data in the user's Zapier Tables.

1. Use list-tables to find the table the task names, and get-table for its details.
2. Use list-table-fields to learn its columns before reading records.
3. Use list-table-records to read or filter rows, and get-table-record for one row by id.

Report what the data says, concisely. You only read. You never create, update or delete tables, fields or records; say so if the task asks for that.`;

/** The Zapier Tables read tools the Tables subagent gets (kebab-case registry ids). */
export const TABLE_READ_TOOL_NAMES = [
  "list-tables",
  "get-table",
  "list-table-fields",
  "list-table-records",
  "get-table-record",
] as const;

let tableToolsCache: ToolsInput | undefined;

function buildTableReadTools(): ToolsInput {
  if (tableToolsCache) return tableToolsCache;
  let all: ToolsInput = {};
  try {
    all = generateZapierTools();
  } catch (err) {
    console.error("[tables subagent] generateZapierTools failed; it will have no tools:", err);
    return {};
  }
  const picked: ToolsInput = {};
  for (const name of TABLE_READ_TOOL_NAMES) {
    if (all[name]) picked[name] = all[name];
  }
  tableToolsCache = picked;
  return picked;
}

type ToolContext = { requestContext?: { get(key: string): unknown } | null } | undefined;

/** The signed-in user a subagent run acts for (never taken from the model's input). */
function callerOf(ctx: ToolContext): string {
  const userId = resolveRequestUserId(ctx?.requestContext);
  if (!userId) throw new Error("A signed-in user is required.");
  return userId;
}

/**
 * Read-only automation tools for the Automations subagent. The main agent's versions
 * take `userId` as model input; these read it from the run's request context, so a
 * subagent can only ever see the signed-in user's workspace.
 */
export const subagentAutomationTools = {
  list_automations: createTool({
    id: "list_automations",
    description:
      "List the workspace's durable automations (id, name, enabled, status, editor link). Read-only.",
    inputSchema: z.object({}),
    execute: async (_input, ctx) => ({ automations: await listForUser(callerOf(ctx)) }),
  }),
  inspect_automation: createTool({
    id: "inspect_automation",
    description:
      "Inspect one workspace automation by its Foreman id: its stored definition, trigger state and recent run history. Read-only.",
    inputSchema: z.object({
      automationId: z.string().describe("The Foreman automation id (from list_automations)."),
      maxRuns: z.number().optional().describe("How many recent runs to include (default 10)."),
    }),
    execute: async ({ automationId, maxRuns }, ctx) => {
      const result = await inspectForUser(callerOf(ctx), automationId, maxRuns ?? 10);
      if (!result) throw new Error("Automation not found in this workspace");
      return result;
    },
  }),
  get_automation_management: createTool({
    id: "get_automation_management",
    description:
      "Read an automation's Zapier agentic-management settings (on/off, heal / expand / harden modes, auto-approve, recorded intent). Read-only.",
    inputSchema: z.object({
      automationId: z.string().describe("The Foreman automation id."),
    }),
    execute: async ({ automationId }, ctx) => {
      const result = await getManagementForUser(callerOf(ctx), automationId);
      if (!result) throw new Error("Automation not found in this workspace");
      return result;
    },
  }),
};

export const FOREMAN_SUBAGENTS: AgentControllerSubagent[] = [
  ...ZAPIER_LOOKUP_SUBAGENTS,
  {
    id: "files",
    name: "Files",
    description:
      "Browses and reads the user's stored files in Zapier (list folders, read a file, check its size). Read-only.",
    instructions: systemPromptFor("files", FILES_PROMPT),
    tools: {
      list_stored_files: listStoredFilesTool,
      read_stored_file: readStoredFileTool,
      stat_stored_file: statStoredFileTool,
    },
    defaultModelId: primary(AGENT_MODELS.files),
    allowedWorkspaceTools: [],
  },
  {
    id: "automations",
    name: "Automations",
    description:
      "Reports on the user's durable Zapier automations: what exists, recent runs and failures, and agentic-management settings. Read-only.",
    instructions: systemPromptFor("automations", AUTOMATIONS_PROMPT),
    tools: subagentAutomationTools,
    defaultModelId: primary(AGENT_MODELS.automations),
    allowedWorkspaceTools: [],
  },
  {
    id: "tables",
    name: "Tables",
    description:
      "Looks up data in the user's Zapier Tables: finds a table, its fields, and reads or filters its records. Read-only.",
    instructions: systemPromptFor("tables", TABLES_PROMPT),
    // A getter, like discovery: the Zapier tools must not be built before new Mastra().
    get tools() {
      return buildTableReadTools();
    },
    defaultModelId: primary(AGENT_MODELS.tables),
    allowedWorkspaceTools: [],
  },
];
