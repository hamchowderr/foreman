/**
 * Unit tests for snapshot retention (pruneSnapshots). No network: getSupabase is
 * mocked. We assert the fast path, that rows beyond `keepLast` are deleted, and
 * that artifact-referenced snapshots are never deleted (dashboards read records
 * by snapshot_id).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let appSnapshotRows: any = null; // app_data_snapshot select result
let artifactReferenced: any = null; // artifact .in(snapshot_id) select result
let deleteError: { message: string } | null = null;
const deletedIds: string[] = [];

function createChain(table: string) {
  const b: any = { _deleting: false };
  for (const m of ["select", "eq", "order", "limit", "gte"]) {
    b[m] = vi.fn(() => b);
  }
  b.delete = vi.fn(() => {
    b._deleting = true;
    return b;
  });
  b.in = vi.fn((_col: string, ids: string[]) => {
    if (b._deleting) deletedIds.push(...ids);
    return b;
  });
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  b.then = (resolve: any) => {
    if (b._deleting) return resolve({ data: null, error: deleteError });
    if (table === "artifact") return resolve({ data: artifactReferenced, error: null });
    return resolve({ data: appSnapshotRows, error: null }); // app_data_snapshot select
  };
  return b;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };
vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

beforeEach(() => {
  appSnapshotRows = null;
  artifactReferenced = null;
  deleteError = null;
  deletedIds.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("pruneSnapshots", () => {
  it("does nothing when row count is within keepLast (fast path)", async () => {
    appSnapshotRows = [{ id: "1" }, { id: "2" }];
    const { pruneSnapshots } = await import("@/lib/dashboards/snapshot");

    const deleted = await pruneSnapshots("user-1", "hubspot", { keepLast: 5 });

    expect(deleted).toBe(0);
    expect(deletedIds).toEqual([]);
  });

  it("deletes rows beyond the newest keepLast", async () => {
    // newest-first
    appSnapshotRows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
    artifactReferenced = []; // nothing pinned
    const { pruneSnapshots } = await import("@/lib/dashboards/snapshot");

    const deleted = await pruneSnapshots("user-1", "hubspot", { keepLast: 2 });

    expect(deleted).toBe(3);
    expect(deletedIds).toEqual(["c", "d", "e"]);
  });

  it("never deletes a snapshot a dashboard artifact is pinned to", async () => {
    appSnapshotRows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
    artifactReferenced = [{ snapshot_id: "d" }]; // artifact pins "d"
    const { pruneSnapshots } = await import("@/lib/dashboards/snapshot");

    const deleted = await pruneSnapshots("user-1", "hubspot", { keepLast: 2 });

    expect(deleted).toBe(2);
    expect(deletedIds).toEqual(["c", "e"]);
    expect(deletedIds).not.toContain("d");
  });

  it("throws when the delete returns an error", async () => {
    appSnapshotRows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    artifactReferenced = [];
    deleteError = { message: "boom" };
    const { pruneSnapshots } = await import("@/lib/dashboards/snapshot");

    await expect(pruneSnapshots("user-1", "hubspot", { keepLast: 1 })).rejects.toThrow(
      /pruneSnapshots failed: boom/,
    );
  });
});
