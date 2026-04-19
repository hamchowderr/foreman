import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateConnectUrl } from "@/lib/zapier/connect";
import { createZapierSdk } from "@zapier/zapier-sdk";

export const connectZapierTool = createTool({
  id: "connect_zapier",
  strict: true,
  description:
    "Generate a URL for the user to connect an app on Zapier. " +
    "If appSlug is provided (e.g. 'gmail', 'trello', 'slack'), generates a direct " +
    "connect link for that specific app. If no appSlug, generates a link to the " +
    "Zapier connections page. Use this when a user needs to connect an app they " +
    "don't have, or when a ZapierNotConnected error occurs.",
  inputSchema: z.object({
    userId: z.string().describe("The Foreman user ID"),
    appSlug: z
      .string()
      .optional()
      .describe(
        "The app slug to connect (e.g. 'gmail', 'trello', 'slack'). " +
        "If not provided, returns the general Zapier connections page URL."
      ),
  }),
  execute: async ({ userId, appSlug }) => {
    // If a specific app is requested, try to get the direct connect URL
    if (appSlug) {
      try {
        const sdk = createZapierSdk();
        const { data: apps } = await sdk.listApps({
          search: appSlug,
          maxItems: 1,
        });
        const app = apps?.[0];
        if (app?.implementation_id) {
          const connectUrl = `https://zapier.com/engine/auth/start/${app.implementation_id}/`;
          return {
            connectUrl,
            appName: app.title,
            message: `Click the link to connect ${app.title} on Zapier. Once connected, come back and I'll complete your request.`,
          };
        }
      } catch {
        // Fall through to generic URL
      }
    }

    // Generic connections page
    return {
      connectUrl: "https://zapier.com/app/assets/connections",
      message:
        "Click the link to connect your apps on Zapier. Once connected, come back and I'll complete your request.",
    };
  },
});
