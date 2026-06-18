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

const pollConfig = z.object({
  app: z.string().min(1).describe("Zapier app key, e.g. 'gmail' or 'google_sheets'."),
  action: z
    .string()
    .min(1)
    .describe("The read action key, e.g. 'new_email' or 'new_or_updated_spreadsheet_row'."),
  connection: z
    .string()
    .optional()
    .describe("Connection id/alias. Auto-discovered for the app if omitted."),
  inputs: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Inputs passed to the read action (e.g. { sheet: '...' })."),
  dedupeKey: z
    .string()
    .min(1)
    .describe(
      "Field on each returned record that uniquely identifies it (e.g. 'id'). " +
        "Records are assumed newest-first; new records are those above the last-seen value.",
    ),
  intervalMinutes: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(5)
    .describe("How often to poll, in minutes (default 5)."),
});

export const attachTriggerTool = createTool({
  id: "attach_trigger",
  description:
    "Bind a saved workflow to an event source so it fires automatically. " +
    "Three trigger types are supported: 'cron' for scheduled runs (e.g. every " +
    "weekday at 9am), 'channel' for chat-message matches (e.g. when you DM " +
    "'!standup' on Slack), and 'poll' to fire when a Zapier read action returns " +
    "a new record (e.g. a new Gmail email or spreadsheet row). Use after " +
    "`save_workflow` and after the user confirms the schedule, match, or poll " +
    "source.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
    type: z.enum(["cron", "channel", "poll"]).describe("Trigger kind."),
    cron: cronConfig.optional().describe("Required when type='cron'."),
    channel: channelConfig.optional().describe("Required when type='channel'."),
    poll: pollConfig.optional().describe("Required when type='poll'."),
    enabled: z
      .boolean()
      .optional()
      .default(true)
      .describe("Set false to register the trigger paused."),
  }),
  outputSchema: z.object({
    id: z.string(),
    type: z.enum(["cron", "channel", "poll"]),
    enabled: z.boolean(),
  }),
  // Attaching a cron / channel trigger means a workflow may fire without
  // further user input. Confirm before binding.
  requireApproval: true,
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string; type?: string };
    console.log(`[tool:${toolName}] attached ${o.type} trigger ${o.id?.slice(0, 8)}`);
  },
  execute: async ({ workflowId, type, cron, channel, poll, enabled }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("attach_trigger: no userId in request context");

    const config = type === "cron" ? cron : type === "channel" ? channel : poll;
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
