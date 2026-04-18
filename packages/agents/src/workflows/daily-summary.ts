import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { gte } from "drizzle-orm";

const fetchRecentActivity = createStep({
  id: "fetch-recent-activity",
  description:
    "Query conversations and action runs updated in the last 24 hours",
  inputSchema: z.object({}),
  outputSchema: z.object({
    conversationCount: z.number(),
    conversationTitles: z.array(z.string()),
    actionRunCount: z.number(),
  }),
  execute: async () => {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentConversations = await db
      .select()
      .from(schema.conversation)
      .where(gte(schema.conversation.updatedAt, since));

    const recentActionRuns = await db
      .select()
      .from(schema.actionRun)
      .where(gte(schema.actionRun.executedAt, since));

    return {
      conversationCount: recentConversations.length,
      conversationTitles: recentConversations
        .map((c) => c.title)
        .filter((t): t is string => t !== null),
      actionRunCount: recentActionRuns.length,
    };
  },
});

const generateSummary = createStep({
  id: "generate-summary",
  description: "Format the activity data into a readable summary",
  inputSchema: z.object({
    conversationCount: z.number(),
    conversationTitles: z.array(z.string()),
    actionRunCount: z.number(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { conversationCount, conversationTitles, actionRunCount } = inputData;

    const titleList =
      conversationTitles.length > 0
        ? `\n  Topics: ${conversationTitles.join(", ")}`
        : "";

    const summary = [
      `[Foreman Daily Summary — ${new Date().toLocaleDateString()}]`,
      `Conversations (24h): ${conversationCount}${titleList}`,
      `Actions executed (24h): ${actionRunCount}`,
    ].join("\n");

    console.log(summary);

    return { summary };
  },
});

export const dailySummaryWorkflow = createWorkflow({
  id: "daily-summary",
  description: "Daily activity summary — conversations and actions from the last 24 hours",
  inputSchema: z.object({}),
  outputSchema: z.object({
    summary: z.string(),
  }),
})
  .then(fetchRecentActivity)
  .then(generateSummary)
  .commit();
