import { RequestContext } from "@mastra/core/request-context";
import { Hono } from "hono";
import {
  createDocumentShare,
  getDocumentShareToken,
  getSharedDocument,
  revokeDocumentShare,
} from "../lib/documents/share";
import {
  canAccessDocPath,
  type DocSpace,
  docPath,
  docsRoot,
  spaceOfPath,
} from "../lib/documents/spaces";
import {
  getVersionContent,
  listVersions,
  recordVersion,
  restoreVersion,
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
 *
 * Documents live in one of two Spaces (foreman-5e4f): the SHARED `documents/`
 * (visible to the whole workspace) or the caller's PERSONAL
 * `_private/<uid>/documents/` (private). `canAccessDocPath` gates every read.
 */
const documents = new Hono<AppEnv>();
// Auth everything EXCEPT the public share read (`/documents/public/:token`),
// where the token itself is the capability — same model as /apps/public.
documents.use("*", (c, next) =>
  c.req.path.includes("/documents/public/") ? next() : authMiddleware(c, next),
);

/** The caller's per-tenant workspace filesystem, resolved by workspace_id. */
function resolveFs(workspaceId: string | undefined) {
  const entries: Array<[string, string]> = [];
  if (workspaceId) entries.push(["workspaceId", workspaceId]);
  return foremanWorkspace.resolveFilesystem({ requestContext: new RequestContext(entries) });
}

// GET /documents — list knowledge documents in the caller's workspace: the
// SHARED space (visible to the whole workspace) plus the caller's own PERSONAL
// space (foreman-5e4f). Each doc is tagged with its space.
async function listSpace(
  fs: NonNullable<Awaited<ReturnType<typeof resolveFs>>>,
  space: DocSpace,
  userId: string | undefined,
) {
  if (space === "personal" && !userId) return [];
  const root = docsRoot(space, userId);
  try {
    const entries = await fs.readdir(root);
    return entries
      .filter((e) => e.type === "file")
      .map((e) => ({ name: e.name, path: `${root}/${e.name}`, size: e.size, space }));
  } catch {
    // dir not created yet — no docs in this space.
    return [];
  }
}

documents.get("/", async (c) => {
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ documents: [] });
  }
  const userId = c.get("userId");
  const [shared, personal] = await Promise.all([
    listSpace(fs, "shared", userId),
    listSpace(fs, "personal", userId),
  ]);
  return c.json({ documents: [...shared, ...personal] });
});

/** filename/title → a safe document slug (mirrors save_document's slugify). */
function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "untitled";
}

// POST /documents/import { name, content, space? } — create a document from an
// uploaded text/markdown file (foreman-iznn follow-up). The client reads the file
// as text and posts its content; the server writes it as documents/<slug>.md in
// the chosen space and snapshots a first version. The slug is derived server-side
// from the filename, so the client never constructs a path.
documents.post("/import", async (c) => {
  const userId = c.get("userId");
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    content?: unknown;
    space?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  if (!content) return c.json({ error: "content is required" }, 400);
  // Guard against oversized payloads (text docs only; ~1MB is generous).
  if (content.length > 1_000_000) return c.json({ error: "file too large (max ~1MB)" }, 413);

  const space: DocSpace = body.space === "personal" ? "personal" : "shared";
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) return c.json({ error: "workspace filesystem unavailable" }, 500);

  const title = name.replace(/\.(md|markdown|txt|text)$/i, "").trim() || "Imported document";
  const path = docPath(space, userId, slugify(title));
  await fs.writeFile(path, content);
  // Best-effort version snapshot — a hiccup must not fail the import (live file
  // is already written, same posture as save_document).
  try {
    await recordVersion(fs, path, { title, content });
  } catch (err) {
    console.error("import: recordVersion failed (doc still saved)", err);
  }
  return c.json({ path, title, space }, 201);
});

// GET /documents/content?path=… — read one document's content. The path must be
// a doc the caller may access: a shared documents/ file or their own personal
// _private/<uid>/documents/ file (canAccessDocPath).
documents.get("/content", async (c) => {
  const rel = c.req.query("path") ?? "";
  if (!canAccessDocPath(rel, c.get("userId"))) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  try {
    const raw = await fs.readFile(rel);
    const content = typeof raw === "string" ? raw : raw.toString("utf8");
    return c.json({ path: rel, content, space: spaceOfPath(rel) });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// GET /documents/versions?path=… — list a document's revisions (newest first),
// backed by the per-doc version manifest (foreman-udji).
documents.get("/versions", async (c) => {
  const path = c.req.query("path") ?? "";
  if (!canAccessDocPath(path, c.get("userId"))) {
    return c.json({ error: "Invalid path" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ current: 0, title: "", versions: [] });
  }
  return c.json(await listVersions(fs, path));
});

// GET /documents/version?path=…&v=2 — read one revision's content from the Mastra
// BlobStore (only hashes in the caller's manifest are fetched).
documents.get("/version", async (c) => {
  const path = c.req.query("path") ?? "";
  const version = Number(c.req.query("v"));
  if (!canAccessDocPath(path, c.get("userId")) || !Number.isInteger(version) || version < 1) {
    return c.json({ error: "Invalid path or version" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  const result = await getVersionContent(fs, path, version);
  if (!result) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ path, version, content: result.content });
});

// POST /documents/restore { path, version } — write an older revision back as the
// live document (recorded as a new revision so history stays append-only).
documents.post("/restore", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { path?: string; version?: number };
  const path = body.path ?? "";
  const version = Number(body.version);
  if (!canAccessDocPath(path, c.get("userId")) || !Number.isInteger(version) || version < 1) {
    return c.json({ error: "Invalid path or version" }, 400);
  }
  const fs = await resolveFs(c.get("workspaceId"));
  if (!fs) {
    return c.json({ error: "Not found" }, 404);
  }
  const manifest = await restoreVersion(fs, path, version);
  if (!manifest) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ path, current: manifest.current });
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

// GET /documents/share?path=… — the document's current share state (token if
// shared, else null), so the UI can show "Shared"/"Share".
documents.get("/share", async (c) => {
  const path = c.req.query("path") ?? "";
  if (!canAccessDocPath(path, c.get("userId"))) {
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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!canAccessDocPath(path, userId)) {
    return c.json({ error: "Invalid path" }, 400);
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
