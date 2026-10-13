/**
 * Durable-automation layer (foreman-l7xq) — built entirely on the experimental
 * Zapier SDK surface. The execution substrate for the trigger/workflow rebuild.
 */

export {
  activeDurableAdapter,
  deliveryForActiveAdapter,
} from "./delivery";
export {
  AGENTIC_MANAGEMENT_MODES,
  type AgenticManagementMode,
  type AgenticManagementPatch,
  type AgenticManagementState,
  cancelDurableRun,
  type DraftTestResult,
  deleteAutomation,
  deployAutomation,
  discardAutomationDraft,
  getAutomationManagement,
  getDurableRunStatus,
  getTriggerRunStatus,
  getWorkflowRunStatus,
  inspectAutomation,
  listAutomations,
  listWorkflowRunsByKind,
  postCallback,
  publishAutomationDraft,
  resolveCallbackUrl,
  runAutomationOnce,
  setAutomationEnabled,
  setAutomationManagement,
  testAutomationDraft,
  triggerAutomation,
  type WorkflowRunKind,
  type WorkflowRunSummary,
} from "./deploy";
export { AGED_DURABLE_DEPS } from "./deps";

export { buildDurableSource, humanApprovalGate } from "./source";
