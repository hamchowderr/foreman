import type { ToolCategory } from "@mastra/core/agent-controller";
import { WORKSPACE_TOOLS } from "@mastra/core/workspace";
import { METHOD_CLASSIFICATION, READ_ONLY_TOOL_IDS } from "../../lib/zapier-sdk-tools";

const { FILESYSTEM, SANDBOX, SEARCH, LSP } = WORKSPACE_TOOLS;

/** Zapier write/destructive tool ids (kebab-case, as `generateZapierTools` names them). */
const toKebab = (name: string) => name.replace(/([A-Z])/g, "-$1").toLowerCase();
export const ZAPIER_APPROVAL_TOOL_IDS: readonly string[] = Array.from(
  METHOD_CLASSIFICATION.APPROVAL_REQUIRED,
  toKebab,
);

/**
 * Tool id → Mastra `ToolCategory`, for the AgentController's `toolCategoryResolver`
 * (adapted from mastra-chat-kit's lib/tool-categories.ts for Foreman's tools).
 *
 * An "Always allow" decision grants the gated tool's CATEGORY for the rest of the
 * session, so a tool only gets a category a user would expect to have agreed to.
 * Deliberately uncategorized (null), so every call asks:
 *  - Zapier APPROVAL_REQUIRED tools (writes/deletes in the user's real apps). One
 *    "Always allow" must never switch off the approval card for every Zapier write.
 *  - create_automation / run_automation: deploy or run a durable workflow.
 *  - start_schedule / stop_schedule: a recurring background run is a real side effect.
 *  - mastra_workspace_delete: destructive.
 */
const CATEGORIES: Record<string, ToolCategory> = {
  // Read: looks things up, changes nothing.
  ...Object.fromEntries(READ_ONLY_TOOL_IDS.map((id) => [id, "read" as const])),
  search_tools: "read",
  // Hands work to a read-only subagent (discovery, history; lib/subagents.ts).
  subagent: "read",
  load_tool: "read",
  search_history: "read",
  list_automations: "read",
  inspect_automation: "read",
  list_schedules: "read",
  [FILESYSTEM.READ_FILE]: "read",
  [FILESYSTEM.LIST_FILES]: "read",
  [FILESYSTEM.FILE_STAT]: "read",
  [FILESYSTEM.GREP]: "read",
  [SEARCH.SEARCH]: "read",
  [LSP.LSP_INSPECT]: "read",
  [SANDBOX.GET_PROCESS_OUTPUT]: "read",

  // Edit: changes files or documents, runs nothing.
  save_document: "edit",
  [FILESYSTEM.WRITE_FILE]: "edit",
  [FILESYSTEM.EDIT_FILE]: "edit",
  [FILESYSTEM.AST_EDIT]: "edit",
  [FILESYSTEM.MKDIR]: "edit",

  // Execute: runs or stops processes in the tenant's sandbox.
  [SANDBOX.EXECUTE_COMMAND]: "execute",
  [SANDBOX.KILL_PROCESS]: "execute",

  // Other: builds something for the user inside Foreman.
  create_dashboard: "other",
  preview_app: "other",
  fork_conversation: "other",
};

export function resolveToolCategory(toolName: string): ToolCategory | null {
  return CATEGORIES[toolName] ?? null;
}

/** Every tool in the `read` category. */
export const READ_TOOLS: readonly string[] = Object.keys(CATEGORIES).filter(
  (name) => CATEGORIES[name] === "read",
);

/**
 * What Plan mode may use (the mode's `availableTools`): the reads to investigate, the
 * workspace write_file tool for the plan file, and submit_plan.
 */
export const PLAN_MODE_TOOLS: readonly string[] = [
  ...READ_TOOLS,
  FILESYSTEM.WRITE_FILE,
  "submit_plan",
];

/**
 * Tools every session runs without an approval card. Two groups:
 *  - the controller's own interaction/bookkeeping tools (ask_user, submit_plan, task_*),
 *    where the prompt or checklist IS the interaction;
 *  - everything Foreman already ran without approval before the AgentController: reads
 *    (Zapier READ_ONLY, tool search, history, automations, schedules, workspace reads),
 *    connect_zapier (it only returns a connect link) and the in-app builders
 *    (dashboards, previews, documents, forks).
 * Zapier writes, automations deploy/run, schedules start/stop and the workspace's
 * write/edit/delete/execute stay gated, as they were.
 */
export const AUTO_ALLOWED_TOOLS: readonly string[] = [
  "ask_user",
  "submit_plan",
  "task_write",
  "task_update",
  "task_complete",
  "task_check",
  ...READ_TOOLS,
  "connect_zapier",
  "save_document",
  "create_dashboard",
  "preview_app",
  "fork_conversation",
];
