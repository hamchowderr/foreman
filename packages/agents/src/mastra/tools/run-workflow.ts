import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { executeWorkflow } from "@/lib/workflows/engine";

export const runWorkflowTool = createTool({
  id: "run_workflow",
  description:
    "Execute a previously saved workflow now. Drains the workflow's step generator " +
    "and returns a summary: runId, steps succeeded / failed, missing params if the " +
    "workflow needs values you didn't provide. Use after `list_workflows` so you " +
    "have the workflow id. If the user asks to 'run my X workflow' or 'fire X', " +
    "this is the tool.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow id (from list_workflows)."),
    inputs: z
      .record(z.string(), z.string())
      .optional()
      .default({})
      .describe(
        "Values for the workflow's parameters (the keys are parameter names " +
          "from get_workflow's response, e.g. { recipient_email: 'a@b.com' }).",
      ),
  }),
  outputSchema: z.object({
    runId: z.string().nullable(),
    status: z.enum(["success", "failed", "param_request", "no_steps"]),
    stepsRun: z.number(),
    stepsFailed: z.number(),
    missingParams: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),
  // Destructive — confirm before running. Avoids the agent unilaterally
  // firing a multi-step workflow that sends emails or creates records.
  requireApproval: true,
  onOutput: ({ output, toolName }) => {
    const o = output as { runId?: string | null; status?: string };
    console.log(`[tool:${toolName}] run=${o.runId?.slice(0, 8) ?? "(none)"} status=${o.status}`);
  },
  execute: async ({ workflowId, inputs }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("run_workflow: no userId in request context");

    let runId: string | null = null;
    let stepsRun = 0;
    let stepsFailed = 0;
    let missingParams: string[] | undefined;
    let errorMessage: string | undefined;
    let finalStatus: "success" | "failed" | "param_request" | "no_steps" = "failed";

    try {
      for await (const event of executeWorkflow(workflowId, userId, inputs ?? {})) {
        if (event.runId) runId = event.runId;
        if (event.type === "step" && event.status === "succeeded") stepsRun++;
        if (event.type === "step" && event.status === "failed") stepsFailed++;
        if (event.type === "param_request") {
          finalStatus = "param_request";
          missingParams = event.missing ?? [];
        }
        if (event.type === "complete") finalStatus = "success";
        if (event.type === "error") {
          errorMessage = event.message;
          if (event.message === "Workflow has no steps") finalStatus = "no_steps";
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    return {
      runId,
      status: finalStatus,
      stepsRun,
      stepsFailed,
      ...(missingParams ? { missingParams } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  },
});
