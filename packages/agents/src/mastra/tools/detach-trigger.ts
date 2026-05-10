import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const detachTriggerTool = createTool({
  id: "detach_trigger",
  strict: true,
  description:
    "Remove a trigger from a workflow. The workflow itself is not deleted. " +
    "Use when the user says 'stop the schedule', 'unbind this from Slack', " +
    "or 'cancel the cron'. Pair with list_workflow_triggers to find the id.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id."),
    triggerId: z.string().describe("The trigger id (from list_workflow_triggers)."),
  }),
  outputSchema: z.object({
    deleted: z.literal(true),
  }),
  // Detaching a trigger silently changes future behavior — confirm.
  requireApproval: true,
  onOutput: ({ toolName }) => {
    console.log(`[tool:${toolName}] trigger detached`);
  },
  execute: async ({ workflowId, triggerId }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("detach_trigger: no userId in request context");

    const supabase = getSupabase();

    const { data: wf } = await supabase
      .from("workflow")
      .select("id")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!wf) throw new Error(`detach_trigger: workflow ${workflowId} not found`);

    const { error } = await supabase
      .from("workflow_trigger")
      .delete()
      .eq("id", triggerId)
      .eq("workflow_id", workflowId);
    if (error) throw new Error(`detach_trigger: ${error.message}`);

    return { deleted: true as const };
  },
});
