import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateConnectUrl } from "@/lib/zapier/connect";

export const connectZapierTool = createTool({
  id: "connect_zapier",
  description:
    "Generate a one-time URL for the user to connect their Zapier account. " +
    "Use this when a user asks to connect Zapier, link their apps, or when a " +
    "ZapierNotConnected error occurs. The user opens the URL in their browser " +
    "to complete OAuth authorization.",
  inputSchema: z.object({
    userId: z.string().describe("The Foreman user ID"),
  }),
  execute: async ({ userId }) => {
    const connectUrl = generateConnectUrl(userId);
    return {
      connectUrl,
      message:
        "Open this link in your browser to connect your Zapier account. " +
        "Once connected, you can close the browser and return here.",
    };
  },
});
