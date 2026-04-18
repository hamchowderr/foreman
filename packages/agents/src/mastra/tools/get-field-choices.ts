import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getInputFieldChoices } from "@/lib/zapier";

export const getFieldChoicesTool = createTool({
  id: "get_field_choices",
  description:
    "Get the available choices for a dropdown-style input field on an action.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    app: z.string().describe("The Zapier app key (e.g. 'gmail', 'slack')"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    action: z.string().describe("The action key"),
    inputField: z
      .string()
      .describe("The input field key to get choices for"),
    connection: z
      .string()
      .optional()
      .describe("Optional connection ID"),
  }),
  execute: async ({ userId, app, actionType, action, inputField, connection }) => {
    const choices = await getInputFieldChoices(
      userId,
      app,
      actionType,
      action,
      inputField,
      connection
    );
    return { choices };
  },
});
