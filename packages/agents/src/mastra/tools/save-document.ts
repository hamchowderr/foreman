import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { docPath as physicalDocPath } from "../../lib/documents/spaces";
import { recordVersion } from "../../lib/documents/versions";
import { requestUserContext } from "../../lib/request-user-context";
import {
  indexSharedDoc,
  resolveWorkspaceFilesystem,
  resolveWorkspaceTenantKey,
} from "../agents/workspace";

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
    "the same title updates that document. Documents are saved to the SHARED team space by " +
    "default (every workspace member can see them); pass space:'personal' for a private note only " +
    "this user should see (e.g. when they say 'just for me', 'private', or 'a personal note'). " +
    "Pass a short title and the full markdown content.",
  inputSchema: z.object({
    title: z.string().describe("Short human title for the document, e.g. 'Q3 launch plan'."),
    content: z.string().describe("The full document body as GitHub-flavored markdown."),
    space: z
      .enum(["shared", "personal"])
      .optional()
      .describe(
        "Where to save it: 'shared' (default — visible to the whole workspace/team) or " +
          "'personal' (private to this user). Only use 'personal' when the user asks for a " +
          "private/personal note.",
      ),
  }),
  toModelOutput: (output) => {
    const o = output as { title: string; path: string };
    return {
      type: "text" as const,
      text: `Saved document "${o.title}" (${o.path}). It is shown in the side panel, and you can read it back anytime with your workspace file tools.`,
    };
  },
  execute: async ({ title, content, space }, context) => {
    // The real RequestContext already carries workspaceId/userId (web); on
    // channels the resolver falls back to the ALS userId — works on every surface.
    const rc = context?.requestContext;
    const fs = await resolveWorkspaceFilesystem(rc);
    if (!fs) throw new Error("save_document: workspace filesystem unavailable");

    // userId is needed for the per-user PERSONAL space path (foreman-5e4f).
    const userId =
      (rc?.get("userId") as string | undefined) ?? requestUserContext.getStore()?.userId;
    // A personal save needs a userId to scope the path; without one, fall back to
    // the shared space rather than failing the save.
    const resolvedSpace = space === "personal" && userId ? "personal" : "shared";

    const slug = slugify(title);
    const path = physicalDocPath(resolvedSpace, userId, slug);
    await fs.writeFile(path, content);
    // Snapshot this revision into the version tree (Mastra BlobStore + manifest,
    // foreman-udji). Best-effort: a versioning hiccup must not fail the save —
    // the live file is already written and is the source of truth.
    try {
      await recordVersion(fs, path, { title, content });
    } catch (err) {
      console.error("save_document: recordVersion failed (doc still saved)", err);
    }
    // Index SHARED docs for semantic search (foreman-aqjx). Best-effort: the doc
    // is already saved; a failed embed must not fail the save. Personal docs are
    // deliberately NOT indexed — they'd become searchable by teammates in the
    // shared per-workspace index (personal search is a per-user-index follow-up).
    if (resolvedSpace === "shared") {
      try {
        const tenantKey = await resolveWorkspaceTenantKey(rc);
        await indexSharedDoc({ tenantKey, path, content, title });
      } catch (err) {
        console.error("save_document: knowledge index failed (doc still saved)", err);
      }
    }
    return { path, title, space: resolvedSpace };
  },
});
