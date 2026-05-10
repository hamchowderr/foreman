import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const updateWorkflowTool = createTool({
  id: "update_workflow",
  strict: true,
  description:
    "Update metadata on a saved workflow — rename it, or mark it as a public " +
    "template that can be cloned by other users. Step content (the ordered " +
    "actions) is intentionally not editable here; to change steps, run the " +
    "workflow again with new inputs and save_workflow under a new name. Use " +
    "this for the user-facing 'rename workflow X to Y' or 'make X a template' " +
    "asks.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
    name: z.string().min(1).max(200).optional().describe("New name. Omit to leave unchanged."),
    isTemplate: z
      .boolean()
      .optional()
      .describe(
        "Set true to publish as a public template, false to revert to private. Omit to leave unchanged.",
      ),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    isTemplate: z.boolean(),
    updatedAt: z.string(),
  }),
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string; name?: string };
    console.log(`[tool:${toolName}] updated ${o.id?.slice(0, 8)} → name="${o.name}"`);
  },
  execute: async ({ workflowId, name, isTemplate }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("update_workflow: no userId in request context");

    if (name === undefined && isTemplate === undefined) {
      throw new Error("update_workflow: at least one of {name, isTemplate} must be provided");
    }

    const supabase = getSupabase();

    // Verify ownership first so we don't bump updated_at on someone else's row
    const { data: existing, error: rErr } = await supabase
      .from("workflow")
      .select("id, name, is_template")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (rErr) throw new Error(`update_workflow: ${rErr.message}`);
    if (!existing) throw new Error(`update_workflow: workflow ${workflowId} not found`);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) patch.name = name;
    if (isTemplate !== undefined) patch.is_template = isTemplate;

    const { error: uErr } = await supabase.from("workflow").update(patch).eq("id", workflowId);
    if (uErr) throw new Error(`update_workflow: ${uErr.message}`);

    return {
      id: workflowId,
      name: (patch.name as string) ?? (existing.name as string),
      isTemplate: (patch.is_template as boolean) ?? (existing.is_template as boolean),
      updatedAt: patch.updated_at as string,
    };
  },
});
