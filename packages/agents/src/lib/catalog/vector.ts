import { embedMany } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { LibSQLVector } from "@mastra/libsql";
import { getEnv } from "../env";

const INDEX_NAME = "catalog_vectors";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;

let _vector: LibSQLVector | undefined;

function getVector(): LibSQLVector {
  if (_vector) return _vector;
  const env = getEnv();
  _vector = new LibSQLVector({
    id: "foreman-catalog",
    url: env.DATABASE_URL,
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

    await vector.upsert({
      indexName: INDEX_NAME,
      vectors: embeddings,
      metadata: batchApps.map((a) => {
        const cats = safeJsonParse(a.categories);
        const categoryNames = Array.isArray(cats)
          ? cats.map((c: any) => c.name ?? c.slug).join(", ")
          : "";
        return {
          appKey: a.appKey,
          title: a.title,
          categories: categoryNames,
        };
      }),
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
