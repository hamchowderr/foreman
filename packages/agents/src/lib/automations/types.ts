/**
 * Shared automation types (foreman-l7xq). The trigger model is the trigger-inbox
 * (the locked design — Foreman owns the lease/ack loop): an automation's trigger
 * is an inbox subscription, and the M3 worker leases it and fires the durable via
 * triggerWorkflow. The durable itself deploys as a manual workflow.
 */

export interface InboxTriggerSpec {
  /** Zapier app key/slug, e.g. "github" or "google-sheets". */
  app: string;
  /** Trigger key, e.g. "new_issue" / "new_row". */
  action: string;
  /** Connection id backing the trigger. */
  connection?: string | number | null;
  /** Trigger input fields, e.g. { repo: "owner/name" }. */
  inputs?: Record<string, unknown>;
}

/** Stable trigger-inbox key for an automation — keyed on its Foreman id (ensureTriggerInbox is idempotent on key). */
export function inboxKeyFor(automationId: string): string {
  return `foreman-auto-${automationId}`;
}
