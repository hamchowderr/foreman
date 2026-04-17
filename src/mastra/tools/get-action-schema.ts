import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getActionInputSchema } from "@/lib/zapier";

export const getActionSchemaTool = createTool({
  id: "get_action_schema",
  description:
    "Get the input field schema for a specific action, showing what parameters are required.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    appKey: z.string().describe("The Zapier app key (e.g. 'gmail')"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    actionKey: z.string().describe("The action key returned from list_actions"),
    connectionId: z
      .string()
      .optional()
      .describe("Optional connection ID to scope the schema"),
  }),
  execute: async ({ userId, appKey, actionType, actionKey, connectionId }) => {
    const schema = await getActionInputSchema(
      userId,
      appKey,
      actionType,
      actionKey,
      connectionId
    );
    return { schema };
  },
});
