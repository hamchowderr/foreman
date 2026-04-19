import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchActionHistory } from "@/lib/rag";

export const searchHistoryTool = createTool({
  id: "search_history",
  strict: true,
  description:
    "Search the user's past action history to find similar actions they've taken before. " +
    "Use this to recommend actions based on what the user has done previously, or to recall " +
    "details about past executions.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural language description of what to search for in action history"
      ),
    userId: z.string().describe("The user ID to search history for"),
    topK: z
      .number()
      .optional()
      .default(5)
      .describe("Number of results to return (default 5)"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        score: z.number(),
        metadata: z.record(z.string(), z.unknown()),
      })
    ),
  }),
  execute: async ({ query, userId, topK }, _ctx) => {
    const results = await searchActionHistory(query, userId, topK);
    return { results };
  },
});
