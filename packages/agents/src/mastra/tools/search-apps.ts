import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchApps } from "@/lib/zapier";

export const searchAppsTool = createTool({
  id: "search_apps",
  description:
    "Search available Zapier apps by name. Use this to find the correct app key " +
    "before listing actions or when the user mentions an app by name.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    search: z.string().describe("Search query (e.g. 'gmail', 'notion', 'hubspot')"),
  }),
  execute: async ({ userId, search }) => {
    const apps = await searchApps(userId, search);
    return { apps };
  },
});
