import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listActionsForApp } from "@/lib/zapier";

export const listActionsTool = createTool({
  id: "list_actions",
  description:
    "List available actions (search, read, write) for a specific connected app.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    app: z.string().describe("The Zapier app key (e.g. 'gmail', 'slack')"),
  }),
  execute: async ({ userId, app }) => {
    const actions = await listActionsForApp(userId, app);
    return { actions };
  },
});
