import { fastembed } from "@mastra/fastembed";
import { PgVector } from "@mastra/pg";
import { embedMany } from "ai";
import { getEnv } from "../env";

/**
 * Knowledge-layer vector primitives (foreman-aqjx).
 *
 * Documents live as markdown files in each tenant's Workspace filesystem
 * (foreman-jgme). The SHARED `documents/` tier is made semantically searchable
 * via Mastra's native Workspace.search — no second RAG pipeline. This module
 * owns only the low-level pieces (vector store, embedder, index-name); the
 * Workspace construction + indexing live in mastra/agents/workspace.ts, which
 * already owns the per-tenant directory logic.
 *
 * WHY one physical index per workspace (not one shared index + a metadata
 * filter): the auto-injected `mastra_workspace_search` tool lets the LLM pick
 * the search `mode` but does NOT expose `filter`, and BM25 ignores filters
 * entirely (a hybrid search merges an unfiltered keyword half). A shared
 * multi-tenant index would therefore leak across workspaces. Giving each
 * workspace its own index makes the index itself the tenant boundary, so the
 * LLM's mode choice can never cross tenants.
 *
 * Embedder = fastembed (local ONNX bge-small, 384-dim) — the same embedder as
 * the app catalog and agent memory, so knowledge search needs no OpenAI
 * key/quota and stays dimension-consistent. The vector index is lazily created
 * on first upsert (dimension inferred), so there is no migration.
 */

let _vector: PgVector | undefined;

/** Lazy PgVector singleton backing every per-workspace knowledge index. */
export function getKnowledgeVector(): PgVector {
  if (_vector) return _vector;
  _vector = new PgVector({ id: "foreman-knowledge", connectionString: getEnv().DATABASE_URL });
  return _vector;
}

/**
 * Batch embedder in the shape Mastra's Workspace SearchEngine expects
 * (`BatchEmbedder`: `(texts) => number[][]` branded `batch: true`). Wraps the
 * fastembed AI-SDK model via `embedMany`, exactly like lib/catalog/vector.ts.
 */
export const knowledgeEmbedder = Object.assign(
  async (texts: string[]): Promise<number[][]> => {
    const { embeddings } = await embedMany({ model: fastembed, values: texts });
    return embeddings;
  },
  { batch: true as const },
);

/**
 * Per-workspace physical index name. Vector index names must be valid SQL
 * identifiers (start with a letter/underscore, only `[A-Za-z0-9_]`, ≤63 chars),
 * so workspace-id hyphens (UUIDs) become underscores. `tenantKey` is the same
 * key the Workspace filesystem is scoped by (a sanitized workspace_id, or the
 * `_shared` fallback), so the index and the files line up 1:1.
 */
export function knowledgeIndexName(tenantKey: string): string {
  const safe = tenantKey.replace(/[^A-Za-z0-9_]/g, "_");
  return `knowledge_${safe}`.slice(0, 63);
}
