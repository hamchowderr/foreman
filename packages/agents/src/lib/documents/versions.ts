import type { WorkspaceFilesystem } from "@mastra/core/workspace";
import { getDocumentBlobStore, hashContent } from "./blob-store";

/**
 * Document version tree (foreman-udji) — the manifest half of document
 * versioning. Each saved revision's *content* lives in the Mastra `BlobStore`
 * (blob-store.ts); this module keeps the ordered list of revisions per document
 * as a manifest file next to the document in the caller's Workspace filesystem,
 * mirroring how Mastra's own skill versioning pairs a BlobStore with a
 * version-tree.
 *
 * Everything is keyed off the document's physical path, so it works for any
 * Space (foreman-5e4f) — `documents/<slug>.md` (shared) or
 * `_private/<uid>/documents/<slug>.md` (personal) — with the manifest stored at
 * `<dir>/.history/<slug>.json` alongside it:
 *   <dir>/<slug>.md            ← the LIVE copy (agent file tools + bm25 see this)
 *   <dir>/.history/<slug>.json ← this manifest (append-only version list)
 *
 * Keeping the manifest as a workspace file (not a DB row) means it is scoped to
 * the tenant's workspace automatically and needs no schema/migration.
 */

/** Split a physical doc path into its directory + slug (basename w/o `.md`). */
function dirAndSlug(docPath: string): { dir: string; slug: string } | null {
  const m = docPath.match(/^(.*?)\/?([^/]+)\.md$/);
  if (!m) return null;
  return { dir: m[1], slug: m[2] };
}

/** The manifest path that sits alongside a document. */
function manifestPathFor(docPath: string): string | null {
  const parts = dirAndSlug(docPath);
  if (!parts) return null;
  const base = parts.dir ? `${parts.dir}/.history` : ".history";
  return `${base}/${parts.slug}.json`;
}

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

/** Basename slug of any valid `…/<slug>.md` path, else null. */
export function slugFromPath(path: string): string | null {
  return dirAndSlug(path)?.slug ?? null;
}

/** Read a document's version manifest, or null if it has no history yet. */
export async function readManifest(
  fs: WorkspaceFilesystem,
  docPath: string,
): Promise<DocumentManifest | null> {
  const manifestPath = manifestPathFor(docPath);
  if (!manifestPath) return null;
  try {
    const raw = await fs.readFile(manifestPath);
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
 * same text don't pad the history. Does NOT write the live `<docPath>` — the
 * caller owns that (save_document already does, restore does below).
 */
export async function recordVersion(
  fs: WorkspaceFilesystem,
  docPath: string,
  args: { title: string; content: string; note?: string },
): Promise<DocumentManifest> {
  const { title, content, note } = args;
  const manifestPath = manifestPathFor(docPath);
  const slug = dirAndSlug(docPath)?.slug;
  if (!manifestPath || !slug) throw new Error(`recordVersion: invalid doc path ${docPath}`);
  const blobHash = hashContent(content);

  const existing = await readManifest(fs, docPath);
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
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

/** List a document's revisions, newest first. Empty if no history. */
export async function listVersions(
  fs: WorkspaceFilesystem,
  docPath: string,
): Promise<{ current: number; title: string; versions: DocumentVersionEntry[] }> {
  const manifest = await readManifest(fs, docPath);
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
  docPath: string,
  version: number,
): Promise<{ content: string; entry: DocumentVersionEntry } | null> {
  const manifest = await readManifest(fs, docPath);
  const entry = manifest?.versions.find((v) => v.version === version);
  if (!entry) return null;

  const blobStore = await getDocumentBlobStore();
  const blob = await blobStore.get(entry.blobHash);
  if (!blob) return null;
  return { content: blob.content, entry };
}

/**
 * Restore an older revision: write it back as the live `<docPath>` and record it
 * as a NEW revision (history stays append-only, so a restore is itself an
 * undoable event). Returns the updated manifest.
 */
export async function restoreVersion(
  fs: WorkspaceFilesystem,
  docPath: string,
  version: number,
): Promise<DocumentManifest | null> {
  const restored = await getVersionContent(fs, docPath, version);
  if (!restored) return null;

  await fs.writeFile(docPath, restored.content);
  return recordVersion(fs, docPath, {
    title: restored.entry.title,
    content: restored.content,
    note: `restored from v${version}`,
  });
}
