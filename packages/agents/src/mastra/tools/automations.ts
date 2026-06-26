import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  deployAutomation,
  getTriggerRunStatus,
  inspectAutomation,
  listAutomations,
  triggerAutomation,
} from "@/lib/durable";
import { getExperimentalSdkForUser } from "@/lib/zapier/sdk";

/**
 * Agent-facing tools for durable automations (foreman-l7xq M1). The agent authors
 * the durable `source` from the user's intent (per the Zapier durable format) and
 * these deploy / run / inspect it on the experimental SDK. create + run create
 * real cloud state, so they require approval. No Foreman DB here — Zapier's
 * listWorkflows/getWorkflow IS the store for M1; M2 layers workspace-scoped
 * persistence + run history on top.
 */

const triggerSchema = z
  .object({
    selectedApi: z
      .string()
      .describe(
        "Version-pinned implementation id (e.g. 'GoogleSheetsAPI@2.3.0'), NOT a bare app key — a bare key makes the trigger claim fail silently.",
      ),
    action: z.string().describe("Trigger action key, e.g. 'new_row'."),
    authenticationId: z
      .string()
      .nullable()
      .optional()
      .describe("Connection id backing the trigger, when it needs auth."),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Trigger params, each shaped to its field value_type (ARRAY vs STRING)."),
  })
  .describe("A Zapier app trigger to claim; omit for manual/webhook automations.");

export const createAutomationTool = createTool({
  id: "create_automation",
  requireApproval: true,
  description:
    "Deploy a durable Zapier automation the user described. You author the durable workflow.ts `source` " +
    "(createZapierSdk() at module scope, one sdk.runAction per ctx.step, defineDurable(...) + export default), " +
    "and this creates + publishes it on Zapier. Provide a `connections` map (alias → connection id) for every " +
    "alias the source references. Add `trigger` for an event-driven automation, or omit it for manual/webhook. " +
    "Returns the workflow id + editor link. If `triggerClaimFailed` is true the workflow deployed but the trigger " +
    "did not claim (usually an unversioned selectedApi).",
  inputSchema: z.object({
    userId: z.string().describe("The user whose Zapier connection deploys the automation."),
    name: z.string().describe("Human-readable automation name."),
    description: z.string().optional(),
    source: z
      .string()
      .describe(
        "The durable workflow.ts source — defineDurable(name, async (ctx, input) => {...}) + export default.",
      ),
    connections: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe("Connection alias → connection id, for every alias the source references."),
    trigger: triggerSchema.optional(),
    enabled: z.boolean().optional().default(true),
    isPrivate: z.boolean().optional().default(true),
  }),
  outputSchema: z.object({
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
      workflowId: output.workflowId,
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
    enabled,
    isPrivate,
  }) => {
    const sdk = await getExperimentalSdkForUser(userId);
    return deployAutomation({
      sdk,
      name,
      description,
      source,
      connections,
      trigger,
      enabled,
      isPrivate,
    });
  },
});

export const runAutomationTool = createTool({
  id: "run_automation",
  requireApproval: true,
  description:
    "Manually fire a deployed automation by its workflow id and return the trigger/run status. Use to test an " +
    "automation on demand. Side effects in connected apps will happen.",
  inputSchema: z.object({
    userId: z.string(),
    workflowId: z.string().describe("The deployed automation's workflow id."),
    input: z.record(z.string(), z.unknown()).optional().describe("Input payload for the run."),
  }),
  outputSchema: z.object({
    triggerId: z.string(),
    status: z.string(),
    durableRunId: z.string().nullable(),
  }),
  execute: async ({ userId, workflowId, input }) => {
    const sdk = await getExperimentalSdkForUser(userId);
    const { triggerId } = await triggerAutomation({ sdk, workflowId, input });
    // Bridge trigger → run for an initial status snapshot (don't long-poll in a tool).
    const run = await getTriggerRunStatus(sdk, triggerId);
    return { triggerId, status: run.status, durableRunId: run.durableRunId };
  },
});

export const listAutomationsTool = createTool({
  id: "list_automations",
  description:
    "List the user's deployed durable automations (id, name, enabled, triggers, editor link). Read-only.",
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({
    automations: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        isPrivate: z.boolean(),
        editorUrl: z.string(),
        triggers: z.unknown(),
      }),
    ),
  }),
  execute: async ({ userId }) => {
    const sdk = await getExperimentalSdkForUser(userId);
    return { automations: await listAutomations(sdk) };
  },
});

export const inspectAutomationTool = createTool({
  id: "inspect_automation",
  description:
    "Inspect one automation: its current definition/trigger state plus recent run history. Read-only.",
  inputSchema: z.object({
    userId: z.string(),
    workflowId: z.string(),
    maxRuns: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    workflow: z.unknown(),
    runs: z.array(z.unknown()),
  }),
  execute: async ({ userId, workflowId, maxRuns }) => {
    const sdk = await getExperimentalSdkForUser(userId);
    return inspectAutomation(sdk, workflowId, maxRuns);
  },
});
