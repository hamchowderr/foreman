import { RequestContext } from "@mastra/core/request-context";
import { Hono } from "hono";
import {
  createDocumentShare,
  getDocumentShareToken,
  getSharedDocument,
  revokeDocumentShare,
} from "../lib/documents/share";
import {
  getVersionContent,
  listVersions,
  restoreVersion,
  slugFromPath,
} from "../lib/documents/versions";
import { foremanWorkspace } from "../mastra/agents/workspace";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Knowledge documents (foreman-aqjx) — the "shared brain" knowledge layer, built
 * directly on the per-tenant Mastra Workspace filesystem (foreman-jgme) instead
 * of a bespoke documents table + RAG stack.
 *
 * A "document" is just a file under `documents/` in the caller's workspace
 * filesystem. The agent creates/edits them with its existing approval-gated
 * Workspace file tools, and `Workspace.search` (bm25) gives doc-RAG for free —
 * so this route only needs to LIST and READ them for the web viewer (the
 * KnowledgePanel, which mirrors the live-preview side panel).
 *
 *   GET /documents                       → list documents (files under documents/)
 *   GET /documents/content?path=documents/foo.md → read one document
 *
 * Resolving through `foremanWorkspace.resolveFilesystem` (not node fs) keeps the
 * containment guarantees and means the route works unchanged when jgme later
 * swaps LocalFilesystem for S3/AgentFS on cloud deploys.
 */
const DOCS_DIR = "documents";

const documents = new Hono<AppEnv>();
// Auth everything EXCEPT the public share read (`/documents/public/:token`),
// where the token itself is the capability — same model as /dashboards/public.
documents.use("*", (c, next) =>
  c.req.path.includes("/documents/public/") ? next() : authMiddleware(c, next),
);

/** The caller's per-tenant workspace filesystem, resolved by workspace_id. */
function resolveFs(workspaceId: string | undefined) {
  const entries: Array<[string, string]> = [];
  if (workspaceId) entries.push(["workspaceId", workspaceId]);
  return foremanWorkspace.resolveFilesystem({ requestContext: new RequestContext(entries) });
}

// GET /documents — list knowledge documents in the caller's workspace.
documents.get("/", async (c) => {
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ documents: [] });
  }
  try {
    const entries = await fs.readdir(DOCS_DIR);
    const docs = entries
      .filter((e) => e.type === "file")
      .map((e) => ({
        name: e.name,
        path: `${DOCS_DIR}/${e.name}`,
        size: e.size,
      }));
    return c.json({ documents: docs });
  } catch {
    // documents/ not created yet — no docs.
    return c.json({ documents: [] });
  }
});

// GET /documents/content?path=documents/foo.md — read one document's content.
documents.get("/content", async (c) => {
  const rel = c.req.query("path") ?? "";
  // The contained filesystem already blocks escapes; validate anyway, and pin
  // reads to the documents/ folder so this can't read arbitrary workspace files.
  if (
    !rel ||
    rel.includes("..") ||
    rel.startsWith("/") ||
    rel.startsWith("\\") ||
    !rel.startsWith(`${DOCS_DIR}/`)
  ) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  try {
    const raw = await fs.readFile(rel);
    const content = typeof raw === "string" ? raw : raw.toString("utf8");
    return c.json({ path: rel, content });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// GET /documents/versions?path=documents/foo.md — list a document's revisions
// (newest first), backed by the per-doc version manifest (foreman-udji).
documents.get("/versions", async (c) => {
  const slug = slugFromPath(c.req.query("path") ?? "");
  if (!slug) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ current: 0, title: "", versions: [] });
  }
  return c.json(await listVersions(fs, slug));
});

// GET /documents/version?path=documents/foo.md&v=2 — read one revision's content
// from the Mastra BlobStore (only hashes in the caller's manifest are fetched).
documents.get("/version", async (c) => {
  const slug = slugFromPath(c.req.query("path") ?? "");
  const version = Number(c.req.query("v"));
  if (!slug || !Number.isInteger(version) || version < 1) {
    return c.json({ error: "Invalid path or version" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  const result = await getVersionContent(fs, slug, version);
  if (!result) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ path: `documents/${slug}.md`, version, content: result.content });
});

// POST /documents/restore { path, version } — write an older revision back as the
// live document (recorded as a new revision so history stays append-only).
documents.post("/restore", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { path?: string; version?: number };
  const slug = slugFromPath(body.path ?? "");
  const version = Number(body.version);
  if (!slug || !Number.isInteger(version) || version < 1) {
    return c.json({ error: "Invalid path or version" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  const manifest = await restoreVersion(fs, slug, version);
  if (!manifest) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ path: `documents/${slug}.md`, current: manifest.current });
});

// GET /documents/public/:token — read a publicly shared document. NO auth: a
// valid, unexpired token is the grant (foreman-jz14). Content is read from the
// owner's workspace fs using the workspace_id stored on the share row.
documents.get("/public/:token", async (c) => {
  const doc = await getSharedDocument(c.req.param("token"));
  if (!doc) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(doc);
});

// GET /documents/share?path=documents/foo.md — the document's current share
// state (token if shared, else null), so the UI can show "Shared"/"Share".
documents.get("/share", async (c) => {
  const path = c.req.query("path") ?? "";
  if (!slugFromPath(path)) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const share = await getDocumentShareToken(c.get("workspaceId"), path);
  return c.json({ share });
});

// POST /documents/share { path, expiresInDays? } — mint a public share token.
documents.post("/share", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    path?: string;
    expiresInDays?: number;
  };
  const path = body.path ?? "";
  if (!slugFromPath(path)) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const share = await createDocumentShare(c.get("workspaceId"), userId, path, {
    expiresInDays: body.expiresInDays,
  });
  if (!share) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(share);
});

// DELETE /documents/share/:token — revoke a share, workspace-scoped.
documents.delete("/share/:token", async (c) => {
  const revoked = await revokeDocumentShare(c.get("workspaceId"), c.req.param("token"));
  return c.json({ revoked });
});

export default documents;
