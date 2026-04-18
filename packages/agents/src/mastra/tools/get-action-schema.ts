import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getInputFieldsSchema } from "@/lib/zapier";

export const getActionSchemaTool = createTool({
  id: "get_action_schema",
  description:
    "Get the JSON Schema for a specific action's input fields, showing parameter types, required fields, and descriptions. " +
    "Returns a proper JSON Schema object that describes exactly what inputs the action expects.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    app: z.string().describe("The Zapier app key (e.g. 'gmail', 'slack')"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    action: z.string().describe("The action key returned from list_actions"),
    connection: z
      .string()
      .optional()
      .describe("Optional connection ID to scope the schema to a specific account"),
  }),
  execute: async ({ userId, app, actionType, action, connection }) => {
    const schema = await getInputFieldsSchema(
      userId,
      app,
      actionType,
      action,
      connection
    );
    return { schema };
  },
});
