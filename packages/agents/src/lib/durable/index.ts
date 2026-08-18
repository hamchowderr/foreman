/**
 * Durable-automation layer (foreman-l7xq) — built entirely on the experimental
 * Zapier SDK surface. The execution substrate for the trigger/workflow rebuild.
 */

export {
  activeDurableAdapter,
  deliveryForActiveAdapter,
} from "./delivery";
export {
  cancelDurableRun,
  deleteAutomation,
  deployAutomation,
  getDurableRunStatus,
  getTriggerRunStatus,
  inspectAutomation,
  listAutomations,
  postCallback,
  resolveCallbackUrl,
  runAutomationOnce,
  setAutomationEnabled,
  triggerAutomation,
} from "./deploy";
export { AGED_DURABLE_DEPS } from "./deps";

export { buildDurableSource, humanApprovalGate } from "./source";
