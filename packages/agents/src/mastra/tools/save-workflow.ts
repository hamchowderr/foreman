import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { saveWorkflowFromConversation } from "@/lib/workflows/save";

export const saveWorkflowTool = createTool({
  id: "save_workflow",
  description:
    "Save the current conversation's executed actions as a re-runnable workflow. " +
    "Captures every action proposal that the user approved and ran, in order, " +
    "and parameterizes obvious values (emails, IDs, phone numbers) so the " +
    "workflow can be re-run with different inputs. Use this when the user " +
    "asks to save what they just did, save as a workflow, save as a template, " +
    "or any phrasing that means 'I want to do this again later.' " +
    "Only call this AFTER at least one action has actually executed in the " +
    "conversation — if nothing has run yet, tell the user to run it first.",
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "A short, human-readable name for the workflow (e.g. 'Daily standup post', 'Invoice → Slack notify').",
      ),
  }),
  outputSchema: z.object({
    workflowId: z.string(),
    steps: z.number(),
    parameters: z.array(z.string()),
  }),
  onOutput: ({ output, toolName }) => {
    const o = output as { workflowId?: string; steps?: number };
    console.log(
      `[tool:${toolName}] saved workflow ${o.workflowId?.slice(0, 8)} (${o.steps ?? 0} steps)`,
    );
  },
  execute: async ({ name }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    const conversationId = context?.requestContext?.get("threadId") as string | undefined;
    if (!userId) throw new Error("save_workflow: no userId in request context");
    if (!conversationId) {
      throw new Error("save_workflow: no conversation thread id in request context");
    }
    return saveWorkflowFromConversation(conversationId, userId, name);
  },
});
