import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const listWorkflowTriggersTool = createTool({
  id: "list_workflow_triggers",
  strict: true,
  description:
    "List the triggers bound to a saved workflow. Use before detaching, " +
    "or when the user asks 'is this scheduled?', 'what fires this?', or " +
    "'when does X run?'.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
  }),
  outputSchema: z.object({
    triggers: z.array(
      z.object({
        id: z.string(),
        type: z.enum(["cron", "channel", "poll"]),
        enabled: z.boolean(),
        config: z.record(z.string(), z.unknown()),
        lastFiredAt: z.string().nullable(),
      }),
    ),
  }),
  onOutput: ({ output, toolName }) => {
    const count = (output as { triggers?: unknown[] })?.triggers?.length ?? 0;
    console.log(`[tool:${toolName}] returned ${count} triggers`);
  },
  execute: async ({ workflowId }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("list_workflow_triggers: no userId in request context");

    const supabase = getSupabase();

    const { data: wf } = await supabase
      .from("workflow")
      .select("id")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!wf) throw new Error(`list_workflow_triggers: workflow ${workflowId} not found`);

    const { data: rows, error } = await supabase
      .from("workflow_trigger")
      .select("id, type, enabled, config, last_fired_at")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`list_workflow_triggers: ${error.message}`);

    return {
      triggers: (rows ?? []).map((r) => ({
        id: r.id as string,
        type: r.type as "cron" | "channel" | "poll",
        enabled: r.enabled as boolean,
        config: JSON.parse((r.config as string) ?? "{}") as Record<string, unknown>,
        lastFiredAt: (r.last_fired_at as string | null) ?? null,
      })),
    };
  },
});
