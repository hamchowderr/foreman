import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  inspectForUser,
  listForUser,
  provisionAutomation,
  runAutomationById,
} from "../../lib/automations/service";

/**
 * Agent-facing tools for durable automations (foreman-l7xq). The agent authors
 * the durable `source` from the user's intent (per the Zapier durable format);
 * these deploy / run / list / inspect it through lib/automations/service, which
 * deploys to Zapier (M1) AND persists the automation as a workspace-shared
 * resource (M2). create + run create real cloud state, so they require approval.
 * list/inspect read the workspace's automations from Foreman's store, keyed by
 * the Foreman automation id.
 */

const triggerSchema = z
  .object({
    app: z
      .string()
      .describe("Zapier app key/slug for the trigger, e.g. 'github' or 'google-sheets'."),
    action: z.string().describe("Trigger key, e.g. 'new_issue' / 'new_row'."),
    connection: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .describe("Connection id backing the trigger."),
    inputs: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Trigger input fields, e.g. { repo: 'owner/name' }."),
  })
  .describe(
    "A trigger-inbox subscription that fires this automation; omit for manual/webhook automations. The worker leases this inbox and fires the durable.",
  );

const scheduleSchema = z
  .object({
    cron: z
      .string()
      .describe(
        "A cron expression (5-part) — e.g. '0 9 * * *' (every day 9am), '*/15 * * * *' (every 15 min), '0 9 * * 1' (Mondays 9am). Times are in `timezone`.",
      ),
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone for the cron, e.g. 'America/New_York'. Defaults to UTC."),
  })
  .describe(
    "Fire this automation on a cron cadence instead of on an event. Mastra's scheduler owns the firing. Mutually exclusive with `trigger`.",
  );

export const createAutomationTool = createTool({
  id: "create_automation",
  requireApproval: true,
  description:
    "Deploy a durable Zapier automation the user described, as a shared workspace automation. You author the " +
    "durable workflow.ts `source` (createZapierSdk() at module scope, one sdk.runAction per ctx.step, " +
    "defineDurable(...) + export default); this creates + publishes it on Zapier and records it in the workspace. " +
    "Provide a `connections` map (alias → connection id) for every alias the source references. Choose ONE trigger: " +
    "`trigger` (an app/action trigger-inbox subscription) for event-driven; `schedule` (a cron expression) for a " +
    "recurring cadence ('every morning at 9' → cron '0 9 * * *'); or omit both for manual/webhook. For a scheduled " +
    "DIGEST that summarizes recent automation activity into the inbox, pass `schedule` + `digest:true` and OMIT " +
    "`source` (a Mastra workflow synthesizes it — no durable). Returns the Foreman automation `id` + editor link.",
  inputSchema: z.object({
    userId: z.string().describe("The user whose Zapier connection deploys the automation."),
    name: z.string().describe("Human-readable automation name."),
    description: z.string().optional(),
    source: z
      .string()
      .optional()
      .describe(
        "The durable workflow.ts source — defineDurable(name, async (ctx, input) => {...}) + export default. Omit ONLY for a digest (digest:true).",
      ),
    connections: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe("Connection alias → connection id, for every alias the source references."),
    trigger: triggerSchema.optional(),
    schedule: scheduleSchema.optional(),
    digest: z
      .boolean()
      .optional()
      .describe(
        "With `schedule`, makes this a daily digest of recent activity (no durable source).",
      ),
    enabled: z.boolean().optional().default(true),
    isPrivate: z.boolean().optional().default(true),
  }),
  outputSchema: z.object({
    id: z.string(),
    workflowId: z.string(),
    versionId: z.string(),
    enabled: z.boolean(),
    isPrivate: z.boolean(),
    editorUrl: z.string(),
    triggerUrl: z.string(),
    triggerClaimFailed: z.boolean(),
    disabledReason: z.string().nullable().optional(),
  }),
  toModelOutput: (output) => ({
    type: "text" as const,
    text: JSON.stringify({
      id: output.id,
      enabled: output.enabled,
      editorUrl: output.editorUrl,
      ...(output.triggerClaimFailed
        ? {
            warning: "trigger did not claim — workflow is disabled",
            disabledReason: output.disabledReason,
          }
        : {}),
    }),
  }),
  execute: async ({
    userId,
    name,
    description,
    source,
    connections,
    trigger,
    schedule,
    digest,
    enabled,
    isPrivate,
  }) =>
    provisionAutomation({
      userId,
      name,
      description,
      source,
      connections,
      trigger,
      schedule,
      digest,
      enabled,
      isPrivate,
    }),
});

export const runAutomationTool = createTool({
  id: "run_automation",
  requireApproval: true,
  description:
    "Manually fire a workspace automation by its Foreman automation id and return the trigger/run status, " +
    "recording the run. Side effects in connected apps will happen.",
  inputSchema: z.object({
    userId: z.string(),
    automationId: z.string().describe("The Foreman automation id (from list/create)."),
    input: z.record(z.string(), z.unknown()).optional().describe("Input payload for the run."),
  }),
  outputSchema: z.object({
    runId: z.string(),
    triggerId: z.string(),
    status: z.string(),
    durableRunId: z.string().nullable(),
  }),
  execute: async ({ userId, automationId, input }) => {
    const result = await runAutomationById(userId, automationId, input);
    if (!result) throw new Error("Automation not found in this workspace");
    return result;
  },
});

export const listAutomationsTool = createTool({
  id: "list_automations",
  description:
    "List the workspace's durable automations (id, name, enabled, status, editor link). Read-only.",
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ automations: z.array(z.unknown()) }),
  execute: async ({ userId }) => ({ automations: await listForUser(userId) }),
});

export const inspectAutomationTool = createTool({
  id: "inspect_automation",
  description:
    "Inspect one workspace automation by its Foreman id: its stored definition/trigger state plus recent run history. Read-only.",
  inputSchema: z.object({
    userId: z.string(),
    automationId: z.string(),
    maxRuns: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    automation: z.unknown(),
    runs: z.array(z.unknown()),
  }),
  execute: async ({ userId, automationId, maxRuns }) => {
    const result = await inspectForUser(userId, automationId, maxRuns);
    if (!result) throw new Error("Automation not found in this workspace");
    return result;
  },
});
