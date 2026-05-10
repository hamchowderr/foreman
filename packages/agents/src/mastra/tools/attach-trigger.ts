import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

/**
 * Per-type config schemas. Stored as JSON in workflow_trigger.config.
 *
 * cron — fired on a schedule by the cron driver process.
 * channel — matched in-line by channel webhook handlers when a message arrives.
 * poll — deferred; will diff a Zapier read action's results against dedupeKey.
 */
const cronConfig = z.object({
  schedule: z
    .string()
    .min(1)
    .describe("5-field cron expression (UTC unless timezone is set). e.g. '0 9 * * 1-5'"),
  timezone: z.string().optional().describe("IANA timezone, e.g. 'America/Los_Angeles'."),
});

const channelConfig = z.object({
  channel: z
    .enum(["slack", "discord", "telegram", "linear", "github", "gchat", "teams", "whatsapp"])
    .describe("Which chat channel emits the event."),
  match: z
    .object({
      command: z
        .string()
        .optional()
        .describe("Exact command/message-prefix to match (e.g. '!standup')."),
      from: z.string().optional().describe("Optional regex on sender id/handle."),
      room: z.string().optional().describe("Optional channel/room/DM target."),
    })
    .describe("Match criteria for the incoming message."),
});

export const attachTriggerTool = createTool({
  id: "attach_trigger",
  strict: true,
  description:
    "Bind a saved workflow to an event source so it fires automatically. " +
    "Two trigger types are supported today: 'cron' for scheduled runs (e.g. " +
    "every weekday at 9am) and 'channel' for chat-message matches (e.g. when " +
    "you DM '!standup' on Slack). The 'poll' type is reserved for future use. " +
    "Use after `save_workflow` and after the user confirms the schedule or " +
    "match condition.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
    type: z
      .enum(["cron", "channel"])
      .describe("Trigger kind. 'poll' is not yet exposed via the agent."),
    cron: cronConfig.optional().describe("Required when type='cron'."),
    channel: channelConfig.optional().describe("Required when type='channel'."),
    enabled: z
      .boolean()
      .optional()
      .default(true)
      .describe("Set false to register the trigger paused."),
  }),
  outputSchema: z.object({
    id: z.string(),
    type: z.enum(["cron", "channel"]),
    enabled: z.boolean(),
  }),
  // Attaching a cron / channel trigger means a workflow may fire without
  // further user input. Confirm before binding.
  requireApproval: true,
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string; type?: string };
    console.log(`[tool:${toolName}] attached ${o.type} trigger ${o.id?.slice(0, 8)}`);
  },
  execute: async ({ workflowId, type, cron, channel, enabled }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("attach_trigger: no userId in request context");

    const config = type === "cron" ? cron : channel;
    if (!config) {
      throw new Error(`attach_trigger: type='${type}' requires the matching '${type}' field`);
    }

    const supabase = getSupabase();

    // Ownership check — keep parity with the route
    const { data: wf } = await supabase
      .from("workflow")
      .select("id")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!wf) throw new Error(`attach_trigger: workflow ${workflowId} not found`);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("workflow_trigger").insert({
      id,
      workflow_id: workflowId,
      type,
      config: JSON.stringify(config),
      enabled: enabled ?? true,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(`attach_trigger: ${error.message}`);

    return { id, type, enabled: enabled ?? true };
  },
});
