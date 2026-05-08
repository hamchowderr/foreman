import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { PgVector } from "@mastra/pg";
import { getEnv } from "../env";

const INDEX_NAME = "catalog_vectors";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;

let _vector: PgVector | undefined;

function getVector(): PgVector {
  if (_vector) return _vector;
  const env = getEnv();
  _vector = new PgVector({
    id: "foreman-catalog",
    connectionString: env.DATABASE_URL,
  });
  return _vector;
}

function getEmbedder() {
  return new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
}

export async function ensureCatalogIndex(): Promise<void> {
  const vector = getVector();
  try {
    const indexes = await vector.listIndexes();
    if (!indexes.includes(INDEX_NAME)) {
      await vector.createIndex({
        indexName: INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
      });
    }
  } catch {
    // Index creation may fail if tables already exist in a different format.
    // The upsert call will create the index implicitly if needed.
  }
}

/**
 * Embed and index app catalog entries.
 * Each app becomes one vector with metadata for filtering.
 */
export async function indexAppCatalog(
  apps: Array<{
    appKey: string;
    title: string;
    categories: string;
    embeddingText: string;
  }>,
): Promise<void> {
  await ensureCatalogIndex();

  if (apps.length === 0) return;

  const embedder = getEmbedder();
  const texts = apps.map((a) => a.embeddingText);

  const BATCH_SIZE = 100;
  const vector = getVector();

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchApps = apps.slice(i, i + BATCH_SIZE);

    const { embeddings } = await embedMany({
      model: embedder,
      values: batch,
    });

    const batchMetadata = batchApps.map((a) => {
      const cats = safeJsonParse(a.categories);
      const categoryNames = Array.isArray(cats)
        ? cats.map((c: any) => c.name ?? c.slug).join(", ")
        : "";
      return {
        appKey: a.appKey,
        title: a.title,
        categories: categoryNames,
      };
    });

    await vector.upsert({
      indexName: INDEX_NAME,
      vectors: embeddings,
      metadata: batchMetadata,
      // Stable IDs derived from appKey so re-runs update rather than append
      ids: batchApps.map((a) => appKeyToVectorId(a.appKey)),
    });

    if (i + BATCH_SIZE < texts.length) {
      console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} apps`);
    }
  }
}

/**
 * Semantic search over the app catalog.
 */
export async function searchAppCatalog(
  query: string,
  topK = 10,
): Promise<
  Array<{
    score: number;
    appKey: string;
    title: string;
    categories: string;
  }>
> {
  await ensureCatalogIndex();

  const embedder = getEmbedder();
  const { embeddings } = await embedMany({
    model: embedder,
    values: [query],
  });

  const vector = getVector();
  const results = await vector.query({
    indexName: INDEX_NAME,
    queryVector: embeddings[0]!,
    topK,
  });

  return results.map((r) => ({
    score: r.score,
    appKey: (r.metadata?.appKey as string) ?? "",
    title: (r.metadata?.title as string) ?? "",
    categories: (r.metadata?.categories as string) ?? "",
  }));
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Derive a stable UUID-shaped vector ID from an app key so upserts are
 * idempotent — re-running the embed phase updates rows, not appends new ones.
 * Uses SHA-256 to avoid prefix collisions (e.g. FacebookConversions* keys).
 */
function appKeyToVectorId(appKey: string): string {
  const hash = createHash("sha256").update(appKey.toLowerCase()).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
