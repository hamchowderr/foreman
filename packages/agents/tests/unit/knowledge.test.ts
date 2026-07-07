/**
 * Unit tests for the knowledge-layer vector primitives (foreman-aqjx).
 *
 * The per-workspace index name IS the tenant isolation boundary, so its
 * derivation must be deterministic and produce a valid SQL identifier. The
 * embedder must carry the `batch: true` brand Mastra's SearchEngine checks.
 * (End-to-end indexing + search + cross-tenant isolation — indexSharedDoc, which
 * lives in mastra/agents/workspace.ts — is proven by scripts/knowledge-e2e-probe.ts
 * against real Postgres.)
 */
import { describe, expect, it, vi } from "vitest";

const mockEmbeddings = [[0.1, 0.2, 0.3]];

vi.mock("@mastra/pg", () => ({ PgVector: class {} }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: "postgres://test" }) }));
vi.mock("ai", () => ({ embedMany: vi.fn(async () => ({ embeddings: mockEmbeddings })) }));

import { knowledgeEmbedder, knowledgeIndexName } from "@/lib/knowledge/vector";

describe("knowledgeIndexName", () => {
  it("prefixes and replaces non-identifier chars (UUID hyphens) with underscores", () => {
    expect(knowledgeIndexName("11112222-3333-4444-5555-666677778888")).toBe(
      "knowledge_11112222_3333_4444_5555_666677778888",
    );
  });

  it("handles the shared fallback key", () => {
    expect(knowledgeIndexName("_shared")).toBe("knowledge__shared");
  });

  it("produces a valid vector-index identifier (letter/underscore start, [A-Za-z0-9_])", () => {
    const name = knowledgeIndexName("abc-DEF-123");
    expect(name).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
  });

  it("caps length at 63 chars for over-long ids", () => {
    const name = knowledgeIndexName("x".repeat(120));
    expect(name.length).toBe(63);
    expect(name.startsWith("knowledge_")).toBe(true);
  });
});

describe("knowledgeEmbedder", () => {
  it("is branded batch-capable (Mastra SearchEngine checks this)", () => {
    expect(knowledgeEmbedder.batch).toBe(true);
  });

  it("returns embeddings for a batch of texts", async () => {
    const out = await knowledgeEmbedder(["hello"]);
    expect(out).toEqual(mockEmbeddings);
  });
});
