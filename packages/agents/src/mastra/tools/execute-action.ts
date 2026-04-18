import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runAction } from "@/lib/zapier";

export const executeActionTool = createTool({
  id: "execute_action",
  description:
    "Execute a Zapier action with the given inputs. When the user confirms with " +
    "'yes', 'ok', 'go ahead', 'do it', or similar, call this tool immediately. " +
    "Do NOT re-ask for confirmation — just execute.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    app: z.string().describe("The Zapier app key (e.g. 'gmail', 'slack')"),
    actionType: z
      .enum(["search", "read", "write", "run", "filter", "read_bulk", "search_and_write", "search_or_write"])
      .describe("The action type"),
    action: z.string().describe("The action key to execute"),
    inputs: z
      .record(z.string(), z.unknown())
      .describe("The input parameters for the action"),
    connection: z
      .string()
      .describe("The connection ID from discover_connections. REQUIRED — always pass this."),
    humanLabel: z
      .string()
      .describe(
        "A plain-English sentence describing what this action will do, shown to the user for approval"
      ),
  }),
  execute: async ({ userId, app, actionType, action, inputs, connection }) => {
    const result = await runAction(
      userId,
      app,
      actionType,
      action,
      inputs,
      connection
    );
    return { result };
  },
});
