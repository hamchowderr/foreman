import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const getWorkflowTool = createTool({
  id: "get_workflow",
  description:
    "Fetch a single saved workflow with its ordered steps. Use this when the user " +
    "asks to inspect, edit, or run a specific workflow — call list_workflows first " +
    "if you don't already have the id.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    parameters: z.array(z.string()),
    steps: z.array(
      z.object({
        order: z.number(),
        appKey: z.string().nullable(),
        actionType: z.string().nullable(),
        actionKey: z.string().nullable(),
        humanLabel: z.string().nullable(),
        inputs: z.record(z.string(), z.unknown()),
      }),
    ),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string; steps?: unknown[] };
    console.log(`[tool:${toolName}] fetched ${o.id?.slice(0, 8)} (${o.steps?.length ?? 0} steps)`);
  },
  execute: async ({ workflowId }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("get_workflow: no userId in request context");

    const supabase = getSupabase();
    const { data: wf, error: wErr } = await supabase
      .from("workflow")
      .select("*")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr) throw new Error(`get_workflow: ${wErr.message}`);
    if (!wf) throw new Error(`get_workflow: workflow ${workflowId} not found`);

    const { data: stepRows, error: sErr } = await supabase
      .from("workflow_step")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("order", { ascending: true });
    if (sErr) throw new Error(`get_workflow: ${sErr.message}`);

    const steps = (stepRows ?? []).map((s) => {
      const tpl = JSON.parse(s.proposal_template as string) as Record<string, unknown>;
      return {
        order: s.order as number,
        appKey: (tpl.appKey as string) ?? null,
        actionType: (tpl.actionType as string) ?? null,
        actionKey: (tpl.actionKey as string) ?? null,
        humanLabel: (tpl.humanLabel as string) ?? null,
        inputs: (tpl.inputs as Record<string, unknown>) ?? {},
      };
    });

    return {
      id: wf.id as string,
      name: wf.name as string,
      parameters: JSON.parse((wf.parameters as string) ?? "[]") as string[],
      steps,
      createdAt: wf.created_at as string,
      updatedAt: wf.updated_at as string,
    };
  },
});
