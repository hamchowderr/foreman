import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const deleteWorkflowTool = createTool({
  id: "delete_workflow",
  strict: true,
  description:
    "Permanently delete a saved workflow and all of its run history. " +
    "Cascades to workflow_step + workflow_run rows. This is irreversible. " +
    "Only call when the user explicitly asks to delete / remove / forget a " +
    "specific workflow. Always confirm with them first if there is any " +
    "ambiguity about which one.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
  }),
  outputSchema: z.object({
    id: z.string(),
    deleted: z.literal(true),
  }),
  // Destructive — Mastra wraps this in an approval prompt.
  requireApproval: true,
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string };
    console.log(`[tool:${toolName}] deleted ${o.id?.slice(0, 8)}`);
  },
  execute: async ({ workflowId }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("delete_workflow: no userId in request context");

    const supabase = getSupabase();

    // Verify ownership before deleting anything
    const { data: existing, error: rErr } = await supabase
      .from("workflow")
      .select("id")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (rErr) throw new Error(`delete_workflow: ${rErr.message}`);
    if (!existing) throw new Error(`delete_workflow: workflow ${workflowId} not found`);

    // Cascade manually — same path as the DELETE /workflows/:id route.
    // FK cascade is not declared in the schema today.
    const { error: rrErr } = await supabase
      .from("workflow_run")
      .delete()
      .eq("workflow_id", workflowId);
    if (rrErr) throw new Error(`delete_workflow: ${rrErr.message}`);

    const { error: sErr } = await supabase
      .from("workflow_step")
      .delete()
      .eq("workflow_id", workflowId);
    if (sErr) throw new Error(`delete_workflow: ${sErr.message}`);

    const { error: wErr } = await supabase.from("workflow").delete().eq("id", workflowId);
    if (wErr) throw new Error(`delete_workflow: ${wErr.message}`);

    return { id: workflowId, deleted: true as const };
  },
});
