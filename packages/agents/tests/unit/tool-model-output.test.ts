import { describe, expect, it } from "vitest";
import { createAutomationTool } from "@/mastra/tools/automations";
import { createDashboardTool } from "@/mastra/tools/create-dashboard";
import { previewAppTool } from "@/mastra/tools/preview-app";
import { saveDocumentTool } from "@/mastra/tools/save-document";
import { searchHistoryTool } from "@/mastra/tools/search-history";

/**
 * `toModelOutput` must return an AI SDK tool-result output. The text variant
 * is `{ type: "text", value }` — a `text` key is silently dropped and the model
 * sees an empty tool result.
 */
const cases: Array<[string, { toModelOutput?: (o: never) => unknown }, unknown]> = [
  ["search_history", searchHistoryTool, { results: [{ score: 0.9, metadata: { app: "gmail" } }] }],
  ["create_dashboard", createDashboardTool, { title: "T", rowCount: 1, appKey: "a", url: "/x" }],
  ["save_document", saveDocumentTool, { title: "T", path: "/p" }],
  ["preview_app", previewAppTool, { url: "/x", title: "T" }],
  [
    "create_automation",
    createAutomationTool,
    {
      id: "a1",
      enabled: true,
      isPrivate: false,
      editorUrl: "",
      triggerUrl: "",
      triggerClaimFailed: false,
    },
  ],
];

describe("tool toModelOutput shape", () => {
  it.each(cases)("%s returns { type: 'text', value }", (_name, tool, output) => {
    const result = tool.toModelOutput?.(output as never) as { type: string; value: unknown };
    expect(result.type).toBe("text");
    expect(typeof result.value).toBe("string");
    expect((result.value as string).length).toBeGreaterThan(0);
  });
});
