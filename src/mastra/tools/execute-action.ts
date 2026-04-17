import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runAction } from "@/lib/zapier";

export const executeActionTool = createTool({
  id: "execute_action",
  description:
    "Execute a Zapier action with the given inputs. Requires user approval before running.",
  requireApproval: true,
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    appKey: z.string().describe("The Zapier app key"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    actionKey: z.string().describe("The action key to execute"),
    inputs: z
      .record(z.string(), z.unknown())
      .describe("The input parameters for the action"),
    connectionId: z
      .string()
      .optional()
      .describe("Optional connection ID"),
    humanLabel: z
      .string()
      .describe(
        "A plain-English sentence describing what this action will do, shown to the user for approval"
      ),
  }),
  execute: async ({ userId, appKey, actionType, actionKey, inputs, connectionId }) => {
    const result = await runAction(
      userId,
      appKey,
      actionType,
      actionKey,
      inputs,
      connectionId
    );
    return { result };
  },
});
