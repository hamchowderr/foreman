import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { rawFetch } from "@/lib/zapier";

export const rawApiCallTool = createTool({
  id: "raw_api_call",
  description:
    "Make a raw HTTP request through a Zapier connection using zapier.fetch(). " +
    "The user's stored credentials (OAuth tokens, API keys) are auto-injected into the request. " +
    "Only use when no pre-built action can accomplish the goal. Requires user approval.",

  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    url: z.string().url().describe("The full URL to request"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
      .describe("HTTP method"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional request headers"),
    body: z.unknown().optional().describe("Optional request body"),
    connection: z
      .string()
      .describe("The connection ID — credentials are auto-injected from this connection"),
    humanLabel: z
      .string()
      .describe(
        "A plain-English sentence describing what this API call will do"
      ),
  }),
  execute: async ({ userId, url, method, headers, body, connection }) => {
    const result = await rawFetch(userId, url, {
      method,
      headers,
      body,
      connection,
    });
    return { result };
  },
});
