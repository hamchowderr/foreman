import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

export const listWorkflowsTool = createTool({
  id: "list_workflows",
  description:
    "List the user's saved workflows. Returns id, name, and parameters for each. " +
    "Use this when the user asks 'what workflows do I have?', 'show my saved automations', " +
    "or before running/editing/deleting one (so you can pick the right id).",
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Max workflows to return. Default 20."),
  }),
  outputSchema: z.object({
    workflows: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        parameters: z.array(z.string()),
        updatedAt: z.string(),
      }),
    ),
  }),
  toModelOutput: (output) => ({
    type: "text" as const,
    text:
      output.workflows.length === 0
        ? "(no saved workflows yet)"
        : output.workflows
            .map(
              (w, i) =>
                `${i + 1}. ${w.name} — id=${w.id.slice(0, 8)} ` + `(${w.parameters.length} params)`,
            )
            .join("\n"),
  }),
  onOutput: ({ output, toolName }) => {
    const count = (output as { workflows?: unknown[] })?.workflows?.length ?? 0;
    console.log(`[tool:${toolName}] returned ${count} workflows`);
  },
  execute: async ({ limit }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("list_workflows: no userId in request context");

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("workflow")
      .select("id, name, parameters, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);

    if (error) throw new Error(`list_workflows: ${error.message}`);

    return {
      workflows: (rows ?? []).map((w) => ({
        id: w.id as string,
        name: w.name as string,
        parameters: JSON.parse((w.parameters as string) ?? "[]") as string[],
        updatedAt: w.updated_at as string,
      })),
    };
  },
});
