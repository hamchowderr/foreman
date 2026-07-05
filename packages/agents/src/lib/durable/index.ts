/**
 * Durable-automation layer (foreman-l7xq) — built entirely on the experimental
 * Zapier SDK surface. The execution substrate for the trigger/workflow rebuild.
 */

export {
  type AutomationSummary,
  cancelDurableRun,
  type DeployAutomationOptions,
  type DeployResult,
  type DurableCallback,
  type DurableOpDetail,
  type DurableRunDetail,
  deleteAutomation,
  deployAutomation,
  editorUrl,
  getDurableRunStatus,
  getTriggerRunStatus,
  inspectAutomation,
  listAutomations,
  runAutomationOnce,
  setAutomationEnabled,
  triggerAutomation,
} from "./deploy";
export { AGED_DURABLE_DEPS } from "./deps";
export { buildDurableSource } from "./source";
export type { ActionType, AutomationSpec, AutomationStep, AutomationTrigger } from "./types";
