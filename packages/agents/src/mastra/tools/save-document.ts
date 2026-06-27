import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { foremanWorkspace } from "../agents/workspace";

/**
 * save_document (foreman-aqjx) — the write side of the knowledge layer. Persists
 * a markdown document as a file under `documents/` in the caller's per-tenant
 * Workspace filesystem (foreman-jgme), so it survives the conversation and BOTH
 * the user (via the KnowledgePanel viewer) and the agent (via Workspace search +
 * file tools) can read it later. Pairs with the GET /documents read API.
 *
 * A dedicated tool (not the generic approval-gated workspace write) because
 * saving a knowledge doc the user asked for is low-risk and should be one step,
 * and because the tool result drives the inline chip → side-panel viewer, exactly
 * like preview_app does for live apps.
 *
 * No `strict: true` / `outputSchema` — same Anthropic-grammar constraints as the
 * other custom tools; the result flows to the UI as part.output.
 */
function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "untitled";
}

export const saveDocumentTool = createTool({
  id: "save_document",
  description:
    "Save a knowledge document (markdown) to the user's workspace so it persists and both the " +
    "user and you can read it back later. Use this when the user asks you to write up, save, or " +
    "keep a note, plan, summary, brief, spec, or doc — or to capture shared context for the team. " +
    "The document is stored in the workspace and shown in a side panel the user can open. Reusing " +
    "the same title updates that document. Pass a short title and the full markdown content.",
  inputSchema: z.object({
    title: z.string().describe("Short human title for the document, e.g. 'Q3 launch plan'."),
    content: z.string().describe("The full document body as GitHub-flavored markdown."),
  }),
  toModelOutput: (output) => {
    const o = output as { title: string; path: string };
    return {
      type: "text" as const,
      text: `Saved document "${o.title}" (${o.path}). It is shown in the side panel, and you can read it back anytime with your workspace file tools.`,
    };
  },
  execute: async ({ title, content }, context) => {
    const entries: Array<[string, string]> = [];
    const wsId = context?.requestContext?.get("workspaceId") as string | undefined;
    if (wsId) entries.push(["workspaceId", wsId]);
    // Empty entries → the workspace resolver falls back to the ALS userId
    // (channels), so this works on every surface.
    const fs = await foremanWorkspace.resolveFilesystem({
      requestContext: new RequestContext(entries),
    });
    if (!fs) throw new Error("save_document: workspace filesystem unavailable");

    const path = `documents/${slugify(title)}.md`;
    await fs.writeFile(path, content);
    return { path, title };
  },
});
