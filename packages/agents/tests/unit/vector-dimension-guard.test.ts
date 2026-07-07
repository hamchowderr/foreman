/**
 * Unit tests for the vector-index dimension guard (foreman-hcim).
 *
 * ensureIndex must drop+recreate an index that exists at the wrong dimension
 * (the 1536->384 embedder switch), and otherwise leave it untouched. Without
 * this, 384-d upserts against a stale 1536-d index fail on any env where the
 * index already existed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVector = {
  listIndexes: vi.fn(),
  describeIndex: vi.fn(),
  deleteIndex: vi.fn(),
  createIndex: vi.fn(),
};

vi.mock("@mastra/pg", () => ({
  // A class (not an arrow fn — biome would rewrite that and break `new`) whose
  // constructor returns our mock, so `new PgVector(...)` yields mockVector.
  PgVector: class {
    constructor() {
      Object.assign(this, mockVector);
    }
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: "postgres://test" }) }));

import { ensureIndex } from "@/lib/rag";

beforeEach(() => {
  vi.clearAllMocks();
  mockVector.describeIndex.mockResolvedValue({ dimension: 384, count: 0, metric: "cosine" });
  mockVector.deleteIndex.mockResolvedValue(undefined);
  mockVector.createIndex.mockResolvedValue(undefined);
});

describe("ensureIndex — dimension guard", () => {
  it("creates the index when it does not exist", async () => {
    mockVector.listIndexes.mockResolvedValue([]);
    await ensureIndex();
    expect(mockVector.createIndex).toHaveBeenCalledWith(
      expect.objectContaining({ indexName: "action_history", dimension: 384 }),
    );
    expect(mockVector.deleteIndex).not.toHaveBeenCalled();
    expect(mockVector.describeIndex).not.toHaveBeenCalled();
  });

  it("leaves a correctly-dimensioned index untouched", async () => {
    mockVector.listIndexes.mockResolvedValue(["action_history"]);
    mockVector.describeIndex.mockResolvedValue({ dimension: 384, count: 5, metric: "cosine" });
    await ensureIndex();
    expect(mockVector.deleteIndex).not.toHaveBeenCalled();
    expect(mockVector.createIndex).not.toHaveBeenCalled();
  });

  it("drops and recreates a stale 1536-d index at 384-d", async () => {
    mockVector.listIndexes.mockResolvedValue(["action_history"]);
    mockVector.describeIndex.mockResolvedValue({ dimension: 1536, count: 9, metric: "cosine" });
    await ensureIndex();
    expect(mockVector.deleteIndex).toHaveBeenCalledWith({ indexName: "action_history" });
    expect(mockVector.createIndex).toHaveBeenCalledWith(
      expect.objectContaining({ indexName: "action_history", dimension: 384 }),
    );
  });

  it("leaves the index untouched when its dimension can't be read", async () => {
    mockVector.listIndexes.mockResolvedValue(["action_history"]);
    mockVector.describeIndex.mockRejectedValue(new Error("describe failed"));
    await ensureIndex();
    expect(mockVector.deleteIndex).not.toHaveBeenCalled();
    expect(mockVector.createIndex).not.toHaveBeenCalled();
  });
});
