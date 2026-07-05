/**
 * Run a scheduled durable automation (foreman-bhb5). The native replacement for
 * the non-digest branch of the retired `runDueSchedules`. Fired by Mastra's
 * WorkflowScheduler via a per-automation schedule carrying `inputData`
 * `{ workspaceId, automationId }`: triggers the automation's Zapier durable and
 * records the run as "started" — the inbox worker's reconcile advances it to
 * terminal, exactly like an event-fired run.
 */
import "@mastra/core/workflows/evented";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import * as store from "../lib/automations/store";
import { triggerAutomation } from "../lib/durable";
import { getExperimentalSdkForUser } from "../lib/zapier/sdk";

const triggerSchema = z.object({
  workspaceId: z.string().nullable().optional(),
  automationId: z.string(),
});

const fire = createStep({
  id: "fire-automation",
  description: "Trigger the automation's durable on schedule and record the run",
  inputSchema: triggerSchema,
  outputSchema: z.object({ runId: z.string().nullable(), status: z.string() }),
  execute: async ({ inputData }) => {
    const [automation] = await store.getAutomationsByIds([inputData.automationId]);
    if (!automation) return { runId: null, status: "missing" };

    const sdk = await getExperimentalSdkForUser(automation.user_id);
    const input = { scheduledAt: new Date().toISOString() };
    const { triggerId } = await triggerAutomation({
      sdk,
      workflowId: automation.zapier_workflow_id,
      input,
    });
    const runId = await store.recordRun({
      automationId: automation.id,
      workspaceId: automation.workspace_id,
      triggerId,
      status: "started",
      input,
    });
    return { runId, status: "started" };
  },
});

export const runAutomationWorkflow = createWorkflow({
  id: "run-automation",
  description: "Fire a scheduled durable automation and record the run",
  inputSchema: triggerSchema,
  outputSchema: z.object({ runId: z.string().nullable(), status: z.string() }),
})
  .then(fire)
  .commit();
