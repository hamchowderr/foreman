import { createHash } from "node:crypto";
import { BlobsPG } from "@mastra/pg";

/**
 * Document content store (foreman-udji) — the *Mastra primitive* under document
 * versioning.
 *
 * `BlobsPG` is Mastra's concrete `BlobStore`: content-addressable storage keyed
 * by the SHA-256 of the content, with natural deduplication (putting identical
 * bytes twice is a no-op). Mastra ships it for skill versioning; a blob is a
 * blob, so we reuse it to hold every saved revision of a knowledge document.
 *
 * The split mirrors Mastra's own skill versioning exactly: the BlobStore holds
 * the *content* (deduped, immutable, content-addressed) while a per-document
 * version-tree manifest (a file in the caller's Workspace filesystem — see
 * documents/versions.ts) records the ordered list of {version, blobHash}. That
 * keeps the knowledge layer on Workspace files (no bespoke documents table /
 * migration, per-tenant isolation for free) while the content lives in the
 * shared, content-addressed blob table.
 *
 * Cross-tenant safety: blobs are keyed only by content hash, so two tenants with
 * identical content share one row (dedup). A tenant can only *retrieve* a blob
 * whose hash appears in their own manifest, so the shared table never leaks one
 * tenant's content to another (versions.ts only ever `get`s hashes it read from
 * the caller's manifest).
 */

/** SHA-256 hex of UTF-8 content — the BlobStore key. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

let _blobStore: Promise<BlobsPG> | null = null;

/**
 * The process-wide document blob store, memoized. Constructs a `BlobsPG` over a
 * small dedicated pool on the same `DATABASE_URL` as the Mastra storage, and
 * runs `init()` once (idempotent — creates the `mastra_skill_blobs` table if it
 * doesn't exist). Returns the same promise on every call.
 */
export function getDocumentBlobStore(): Promise<BlobsPG> {
  if (_blobStore) return _blobStore;
  _blobStore = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("getDocumentBlobStore: DATABASE_URL is not set");
    // The REST config variant builds and owns its own pool internally — no need
    // to import `pg` here. Same DB as the Mastra PostgresStore.
    const blobs = new BlobsPG({ connectionString });
    await blobs.init();
    return blobs;
  })();
  return _blobStore;
}
