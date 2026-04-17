import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listUserConnections } from "@/lib/zapier";

export const discoverConnectionsTool = createTool({
  id: "discover_connections",
  description:
    "List all apps the user has connected to Zapier. Returns app names, keys, and connection IDs.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID to look up connections for"),
  }),
  execute: async ({ userId }) => {
    const connections = await listUserConnections(userId);
    return { connections };
  },
});
