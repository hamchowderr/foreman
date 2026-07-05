/**
 * Imperative Mastra schedule management for automations (foreman-bhb5). Replaces
 * the custom `runDueSchedules` worker + `schedule.ts`. When a user creates a
 * scheduled/digest automation, we register a row in Mastra's schedules storage
 * (`SchedulesPG`) targeting a workflow with per-automation `inputData`; Mastra's
 * `WorkflowScheduler` then fires it on cron (CAS-deduped across instances). On
 * delete we remove the row.
 *
 * `getMastra` is imported lazily to avoid a static cycle
 * (service → mastra/index → agents → tools → service).
 */
import { computeNextFireAt, validateCron } from "@mastra/core/workflows";

/** Workflow a schedule fires: the digest synthesizer, or the durable runner. */
export type ScheduleTargetWorkflow = "daily-digest" | "run-automation";

/** Stable schedule id for an automation — one schedule per automation. */
export function scheduleIdFor(automationId: string): string {
  return `foreman-auto-${automationId}`;
}

async function getSchedulesStore() {
  const { getMastra } = await import("../../mastra");
  return (await getMastra().getStorage()?.getStore("schedules")) ?? null;
}

/** Throw early on an invalid cron so create_automation surfaces it to the agent. */
export function assertValidCron(cron: string, timezone?: string): void {
  validateCron(cron, timezone);
}

/**
 * Register (or replace) an automation's cron schedule. Deletes any existing row
 * first so an edit is idempotent. Returns false if the schedules store is
 * unavailable (e.g. storage not configured).
 */
export async function registerAutomationSchedule(opts: {
  automationId: string;
  workspaceId: string | null;
  workflow: ScheduleTargetWorkflow;
  cron: string;
  timezone?: string;
}): Promise<boolean> {
  validateCron(opts.cron, opts.timezone);
  const store = await getSchedulesStore();
  if (!store) return false;

  const id = scheduleIdFor(opts.automationId);
  try {
    await store.deleteSchedule(id);
  } catch {
    // No existing row — fine.
  }

  const now = Date.now();
  await store.createSchedule({
    id,
    target: {
      type: "workflow",
      workflowId: opts.workflow,
      inputData: { workspaceId: opts.workspaceId, automationId: opts.automationId },
    },
    cron: opts.cron,
    timezone: opts.timezone,
    status: "active",
    nextFireAt: computeNextFireAt(opts.cron, { timezone: opts.timezone }),
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

/** Remove an automation's schedule (best-effort; no-op if absent). */
export async function unregisterAutomationSchedule(automationId: string): Promise<void> {
  const store = await getSchedulesStore();
  if (!store) return;
  try {
    await store.deleteSchedule(scheduleIdFor(automationId));
  } catch {
    // Already gone — fine.
  }
}
