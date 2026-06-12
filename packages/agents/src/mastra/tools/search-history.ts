import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { backgroundIfEnabled } from "@/lib/background";
import { searchActionHistory } from "@/lib/rag";

export const searchHistoryTool = createTool({
  id: "search_history",
  strict: true,
  // Opt this read into Mastra background execution when FOREMAN_BACKGROUND_TOOLS=1.
  // Simple schema (3 fields) → safe for Studio introspection, unlike the Zapier
  // SDK tools whose schemas hang `mastra dev` when background is enabled.
  ...backgroundIfEnabled(),
  description:
    "Search the user's past action history to find similar actions they've taken before. " +
    "Use this to recommend actions based on what the user has done previously, or to recall " +
    "details about past executions.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Natural language description of what to search for in action history"),
    userId: z.string().describe("The user ID to search history for"),
    topK: z.number().optional().default(5).describe("Number of results to return (default 5)"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        score: z.number(),
        metadata: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  toModelOutput: (output) => {
    // Summarize history results for the model — keep scores and key metadata
    const results = output.results.map((r) => ({
      score: Math.round(r.score * 100) / 100,
      app: (r.metadata as any).app ?? "unknown",
      action: (r.metadata as any).action ?? "unknown",
      date: (r.metadata as any).executedAt ?? (r.metadata as any).date,
    }));
    return { type: "text" as const, text: JSON.stringify(results) };
  },
  onOutput: ({ output, toolName }) => {
    const count = (output as any)?.results?.length ?? 0;
    console.log(`[tool:${toolName}] Found ${count} history results`);
  },
  execute: async ({ query, userId, topK }) => {
    const results = await searchActionHistory(query, userId, topK);
    return { results };
  },
});
