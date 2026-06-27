import type { WorkspaceFilesystem } from "@mastra/core/workspace";
import { getDocumentBlobStore, hashContent } from "./blob-store";

/**
 * Document version tree (foreman-udji) — the manifest half of document
 * versioning. Each saved revision's *content* lives in the Mastra `BlobStore`
 * (blob-store.ts); this module keeps the ordered list of revisions per document
 * as a manifest file in the caller's Workspace filesystem, mirroring how Mastra's
 * own skill versioning pairs a BlobStore with a version-tree.
 *
 * Layout, all inside the caller's per-tenant workspace:
 *   documents/<slug>.md            ← the LIVE copy (what the agent's file tools
 *                                     and bm25 search see; always current)
 *   documents/.history/<slug>.json ← this manifest (append-only version list)
 *
 * Keeping the manifest as a workspace file (not a DB row) means it is scoped to
 * the tenant's workspace automatically and needs no schema/migration.
 */

const DOCS_DIR = "documents";
const HISTORY_DIR = `${DOCS_DIR}/.history`;

export interface DocumentVersionEntry {
  /** 1-based, monotonically increasing. */
  version: number;
  /** SHA-256 of the content — the key into the BlobStore. */
  blobHash: string;
  /** Content size in bytes. */
  size: number;
  /** Document title at the time this revision was saved. */
  title: string;
  /** ISO-8601 timestamp the revision was recorded. */
  createdAt: string;
  /** Optional provenance, e.g. "restored from v2". */
  note?: string;
}

export interface DocumentManifest {
  slug: string;
  /** Title of the latest revision. */
  title: string;
  /** Version number currently written to documents/<slug>.md. */
  current: number;
  /** Append-only, ascending by version. */
  versions: DocumentVersionEntry[];
}

/** documents/<slug>.md → "<slug>". Returns null for anything outside documents/. */
export function slugFromPath(path: string): string | null {
  const m = path.match(/^documents\/([^/]+)\.md$/);
  return m ? m[1] : null;
}

export function livePathForSlug(slug: string): string {
  return `${DOCS_DIR}/${slug}.md`;
}

function manifestPath(slug: string): string {
  return `${HISTORY_DIR}/${slug}.json`;
}

/** Read a document's version manifest, or null if it has no history yet. */
export async function readManifest(
  fs: WorkspaceFilesystem,
  slug: string,
): Promise<DocumentManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath(slug));
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    return JSON.parse(text) as DocumentManifest;
  } catch {
    return null;
  }
}

/**
 * Record a new revision of a document: store its content in the BlobStore and
 * append a manifest entry. No-ops (returns the unchanged manifest) when the
 * content is byte-identical to the current revision, so repeated saves of the
 * same text don't pad the history. Does NOT write the live documents/<slug>.md —
 * the caller owns that (save_document already does, restore does below).
 */
export async function recordVersion(
  fs: WorkspaceFilesystem,
  args: { slug: string; title: string; content: string; note?: string },
): Promise<DocumentManifest> {
  const { slug, title, content, note } = args;
  const blobHash = hashContent(content);

  const existing = await readManifest(fs, slug);
  if (existing) {
    const latest = existing.versions[existing.versions.length - 1];
    if (latest && latest.blobHash === blobHash && existing.current === latest.version) {
      // Identical to current revision — nothing to record.
      return existing;
    }
  }

  const blobStore = await getDocumentBlobStore();
  const size = Buffer.byteLength(content, "utf8");
  await blobStore.put({
    hash: blobHash,
    content,
    size,
    mimeType: "text/markdown",
    createdAt: new Date(),
  });

  const nextVersion = (existing?.versions.at(-1)?.version ?? 0) + 1;
  const entry: DocumentVersionEntry = {
    version: nextVersion,
    blobHash,
    size,
    title,
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };

  const manifest: DocumentManifest = {
    slug,
    title,
    current: nextVersion,
    versions: [...(existing?.versions ?? []), entry],
  };
  await fs.writeFile(manifestPath(slug), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** List a document's revisions, newest first. Empty if no history. */
export async function listVersions(
  fs: WorkspaceFilesystem,
  slug: string,
): Promise<{ current: number; title: string; versions: DocumentVersionEntry[] }> {
  const manifest = await readManifest(fs, slug);
  if (!manifest) return { current: 0, title: "", versions: [] };
  return {
    current: manifest.current,
    title: manifest.title,
    versions: [...manifest.versions].sort((a, b) => b.version - a.version),
  };
}

/**
 * Fetch the content of one revision. Security invariant: only hashes that appear
 * in *this* document's manifest are fetched, so the shared content-addressed
 * blob table can't be used to read another tenant's content.
 */
export async function getVersionContent(
  fs: WorkspaceFilesystem,
  slug: string,
  version: number,
): Promise<{ content: string; entry: DocumentVersionEntry } | null> {
  const manifest = await readManifest(fs, slug);
  const entry = manifest?.versions.find((v) => v.version === version);
  if (!entry) return null;

  const blobStore = await getDocumentBlobStore();
  const blob = await blobStore.get(entry.blobHash);
  if (!blob) return null;
  return { content: blob.content, entry };
}

/**
 * Restore an older revision: write it back as the live documents/<slug>.md and
 * record it as a NEW revision (history stays append-only, so a restore is itself
 * an undoable event). Returns the updated manifest.
 */
export async function restoreVersion(
  fs: WorkspaceFilesystem,
  slug: string,
  version: number,
): Promise<DocumentManifest | null> {
  const restored = await getVersionContent(fs, slug, version);
  if (!restored) return null;

  await fs.writeFile(livePathForSlug(slug), restored.content);
  return recordVersion(fs, {
    slug,
    title: restored.entry.title,
    content: restored.content,
    note: `restored from v${version}`,
  });
}
