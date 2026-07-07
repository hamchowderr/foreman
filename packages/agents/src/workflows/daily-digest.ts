/**
 * Daily digest as a native Mastra Workflow (foreman-bhb5). Replaces the custom
 * worker digest routing. Fired by Mastra's WorkflowScheduler via an imperative
 * per-workspace schedule (schedulesStore.createSchedule) carrying `inputData`
 * `{ workspaceId, automationId }`. Steps: gather recent runs → synthesize a
 * deterministic prioritized digest → narrate (registry agent) → store it as a
 * `finished` automation_run whose output the inbox reads (getLatestDigest).
 *
 * The evented import must load so `createWorkflow` promotes to the evented engine
 * (required for scheduling).
 */
import "@mastra/core/workflows/evented";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { buildDigest, type DigestInputRun } from "../lib/automations/digest";
import { narrateDigest } from "../lib/automations/digest-narrator";
import * as store from "../lib/automations/store";

const DIGEST_PERIOD_MS = 24 * 60 * 60 * 1000;

const triggerSchema = z.object({
  workspaceId: z.string(),
  /** The digest automation to record the run under (the FK anchor + /inbox source). */
  automationId: z.string().optional(),
});

// The digest object is plain JSON (buildDigest output); passed between steps as-is.
const gatheredSchema = triggerSchema.extend({
  periodStart: z.string(),
  periodEnd: z.string(),
  runs: z.array(z.any()),
});
const synthesizedSchema = gatheredSchema.extend({ digest: z.any() });
const resultSchema = z.object({ runId: z.string().nullable(), total: z.number() });

const gatherRuns = createStep({
  id: "gather-runs",
  description: "Collect the workspace's automation runs over the digest period",
  inputSchema: triggerSchema,
  outputSchema: gatheredSchema,
  execute: async ({ inputData }) => {
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - DIGEST_PERIOD_MS).toISOString();
    const rows = await store.listRecentRunsForWorkspace(inputData.workspaceId, periodStart, {
      excludeAutomationId: inputData.automationId,
    });
    const names = new Map(
      (await store.getAutomationsByIds([...new Set(rows.map((r) => r.automation_id))])).map((a) => [
        a.id,
        a.name,
      ]),
    );
    const runs: DigestInputRun[] = rows.map((r) => ({
      automationId: r.automation_id,
      automationName: names.get(r.automation_id) ?? "(deleted automation)",
      status: r.status,
      error: r.error,
      createdAt: r.created_at,
    }));
    return { ...inputData, periodStart, periodEnd, runs };
  },
});

const synthesize = createStep({
  id: "synthesize",
  description: "Aggregate the runs into a deterministic, prioritized digest",
  inputSchema: gatheredSchema,
  outputSchema: synthesizedSchema,
  execute: async ({ inputData }) => {
    const digest = buildDigest(
      inputData.runs as DigestInputRun[],
      inputData.periodStart,
      inputData.periodEnd,
    );
    return { ...inputData, digest };
  },
});

const narrate = createStep({
  id: "narrate",
  description: "Add an LLM prose summary (registry agent; fails soft to null)",
  inputSchema: synthesizedSchema,
  outputSchema: synthesizedSchema,
  execute: async ({ inputData }) => {
    const digest = inputData.digest as ReturnType<typeof buildDigest>;
    digest.narrative = await narrateDigest(digest);
    return { ...inputData, digest };
  },
});

const persist = createStep({
  id: "store-digest",
  description: "Record the digest as a finished automation_run (the /inbox source)",
  inputSchema: synthesizedSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData }) => {
    const digest = inputData.digest as ReturnType<typeof buildDigest>;
    if (!inputData.automationId) return { runId: null, total: digest.totals.total };
    const runId = await store.recordRun({
      automationId: inputData.automationId,
      workspaceId: inputData.workspaceId,
      status: "finished",
      output: digest,
      input: { scheduledAt: digest.periodEnd },
    });
    return { runId, total: digest.totals.total };
  },
});

export const dailyDigestWorkflow = createWorkflow({
  id: "daily-digest",
  description:
    "Synthesize a workspace's recent automation activity into a prioritized inbox digest",
  inputSchema: triggerSchema,
  outputSchema: resultSchema,
})
  .then(gatherRuns)
  .then(synthesize)
  .then(narrate)
  .then(persist)
  .commit();
