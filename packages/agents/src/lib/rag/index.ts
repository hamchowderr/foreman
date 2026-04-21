import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { PgVector } from "@mastra/pg";
import { getEnv } from "@/lib/env";

const INDEX_NAME = "action_history";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;

let _vector: PgVector | undefined;

function getVector(): PgVector {
  if (_vector) return _vector;
  const env = getEnv();
  _vector = new PgVector({
    id: "foreman-rag",
    connectionString: env.DATABASE_URL,
  });
  return _vector;
}

function getEmbedder() {
  return new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
}

export async function ensureIndex(): Promise<void> {
  const vector = getVector();
  const indexes = await vector.listIndexes();
  if (!indexes.includes(INDEX_NAME)) {
    await vector.createIndex({
      indexName: INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }
}

/**
 * Build a human-readable document from an action run + its proposal,
 * then chunk, embed, and store it in the vector index.
 */
export async function indexActionRun(
  run: {
    id: string;
    proposalId: string;
    result: string;
    executedAt: Date;
  },
  proposal: {
    id: string;
    conversationId: string;
    appKey: string;
    actionType: string;
    actionKey: string;
    humanLabel: string;
    inputs: string;
  },
  userId: string
): Promise<void> {
  await ensureIndex();

  const parsedInputs = safeJsonParse(proposal.inputs);
  const parsedResult = safeJsonParse(run.result);

  const text = [
    `Action: ${proposal.humanLabel}`,
    `App: ${proposal.appKey}`,
    `Action Key: ${proposal.actionKey}`,
    `Type: ${proposal.actionType}`,
    `Inputs: ${JSON.stringify(parsedInputs, null, 2)}`,
    `Result: ${JSON.stringify(parsedResult, null, 2)}`,
    `Executed: ${run.executedAt.toISOString()}`,
  ].join("\n");

  const doc = MDocument.fromText(text);
  const chunks = await doc.chunk({
    strategy: "recursive",
    maxSize: 512,
    overlap: 50,
  });

  const embedder = getEmbedder();
  const { embeddings } = await embedMany({
    model: embedder,
    values: chunks.map((c) => c.text),
  });

  const vector = getVector();
  await vector.upsert({
    indexName: INDEX_NAME,
    vectors: embeddings,
    metadata: chunks.map(() => ({
      userId,
      type: "action_run",
      appKey: proposal.appKey,
      actionKey: proposal.actionKey,
      actionType: proposal.actionType,
      proposalId: proposal.id,
      runId: run.id,
      conversationId: proposal.conversationId,
      executedAt: run.executedAt.toISOString(),
    })),
  });
}

/**
 * Index a conversation summary for later semantic recall.
 */
export async function indexConversationSummary(
  conversationId: string,
  summary: string,
  userId: string
): Promise<void> {
  await ensureIndex();

  const doc = MDocument.fromText(summary);
  const chunks = await doc.chunk({
    strategy: "recursive",
    maxSize: 512,
    overlap: 50,
  });

  const embedder = getEmbedder();
  const { embeddings } = await embedMany({
    model: embedder,
    values: chunks.map((c) => c.text),
  });

  const vector = getVector();
  await vector.upsert({
    indexName: INDEX_NAME,
    vectors: embeddings,
    metadata: chunks.map(() => ({
      userId,
      type: "conversation_summary",
      conversationId,
    })),
  });
}

/**
 * Semantic search over past action history for a given user.
 */
export async function searchActionHistory(
  query: string,
  userId: string,
  topK = 5
): Promise<
  Array<{
    score: number;
    metadata: Record<string, unknown>;
  }>
> {
  await ensureIndex();

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
    filter: { userId },
  });

  return results.map((r) => ({
    score: r.score,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }));
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
