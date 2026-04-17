import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getInputFieldChoices } from "@/lib/zapier";

export const getFieldChoicesTool = createTool({
  id: "get_field_choices",
  description:
    "Get the available choices for a dropdown-style input field on an action.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    appKey: z.string().describe("The Zapier app key"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    actionKey: z.string().describe("The action key"),
    fieldKey: z
      .string()
      .describe("The field key to get choices for"),
    connectionId: z
      .string()
      .optional()
      .describe("Optional connection ID"),
  }),
  execute: async ({ userId, appKey, actionType, actionKey, fieldKey, connectionId }) => {
    const choices = await getInputFieldChoices(
      userId,
      appKey,
      actionType,
      actionKey,
      fieldKey,
      connectionId
    );
    return { choices };
  },
});
