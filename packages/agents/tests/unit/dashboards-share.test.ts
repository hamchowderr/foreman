/**
 * Unit tests for the dashboards share lib (Phase 3). No network: getSupabase is
 * mocked per-table. We assert ownership-gating on create, the inserted token
 * row, expiry handling on read, and owner-scoped revoke.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock (per-table results) ───────────────────────────────────────

const inserts: { table: string; payload: any }[] = [];
const calls: { table: string; method: string; args: any[] }[] = [];
// maybeSingle() result per table; awaiting a chain (delete…select) reads `.list`.
let resultsByTable: Record<string, { single?: any; list?: any }> = {};
let insertResult: { error: { message: string } | null } = { error: null };

function createChain(table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "order", "limit", "gte", "update", "delete"]) {
    builder[m] = vi.fn((...args: any[]) => {
      calls.push({ table, method: m, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: resultsByTable[table]?.single ?? null, error: null }),
  );
  builder.insert = vi.fn((payload: any) => {
    inserts.push({ table, payload });
    return Promise.resolve(insertResult);
  });
  // Awaiting the builder (e.g. delete().eq().select("id"), or update().eq()) resolves here.
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  builder.then = (resolve: any) =>
    resolve({ data: resultsByTable[table]?.list ?? null, error: null });
  return builder;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };
vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

const VALID_SPEC = { title: "Leads", blocks: [{ type: "kpi", label: "Total", agg: "count" }] };

beforeEach(() => {
  inserts.length = 0;
  calls.length = 0;
  resultsByTable = {};
  insertResult = { error: null };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── createShare ──────────────────────────────────────────────────────────────

describe("createShare", () => {
  it("mints a token and inserts a dashboard_share row when the artifact is owned", async () => {
    resultsByTable.artifact = { single: { id: "art-1" } };
    const { createShare } = await import("@/lib/dashboards/share");

    const result = await createShare("user-1", "art-1");

    expect(result).not.toBeNull();
    expect(typeof result?.token).toBe("string");
    expect(result?.token.length).toBeGreaterThan(20);
    expect(result?.expiresAt).toBeNull();

    const shareInsert = inserts.find((i) => i.table === "dashboard_share");
    expect(shareInsert).toBeTruthy();
    expect(shareInsert?.payload.artifact_id).toBe("art-1");
    expect(shareInsert?.payload.user_id).toBe("user-1");
    expect(shareInsert?.payload.share_token).toBe(result?.token);
    expect(shareInsert?.payload.expires_at).toBeNull();
  });

  it("returns null and inserts nothing when the artifact is not owned", async () => {
    resultsByTable.artifact = { single: null }; // ownership check fails
    const { createShare } = await import("@/lib/dashboards/share");

    const result = await createShare("user-1", "someone-elses");

    expect(result).toBeNull();
    expect(inserts.find((i) => i.table === "dashboard_share")).toBeUndefined();
  });

  it("sets a future expires_at when expiresInDays is given", async () => {
    resultsByTable.artifact = { single: { id: "art-1" } };
    const { createShare } = await import("@/lib/dashboards/share");

    const result = await createShare("user-1", "art-1", { expiresInDays: 7 });

    expect(result?.expiresAt).toBeTruthy();
    expect(Date.parse(result?.expiresAt as string)).toBeGreaterThan(Date.now());
    const shareInsert = inserts.find((i) => i.table === "dashboard_share");
    expect(shareInsert?.payload.expires_at).toBe(result?.expiresAt);
  });
});

// ─── getSharedArtifact ────────────────────────────────────────────────────────

describe("getSharedArtifact", () => {
  it("resolves a valid token to the owner's artifact data", async () => {
    resultsByTable.dashboard_share = {
      single: { artifact_id: "art-1", user_id: "owner-1", expires_at: null },
    };
    resultsByTable.artifact = {
      single: {
        id: "art-1",
        kind: "dashboard",
        title: "Leads",
        spec: JSON.stringify(VALID_SPEC),
        snapshot_id: null, // no snapshot → records default to []
        updated_at: "2026-06-20T00:00:00.000Z",
      },
    };
    const { getSharedArtifact } = await import("@/lib/dashboards/share");

    const artifact = await getSharedArtifact("tok-1");

    expect(artifact).not.toBeNull();
    expect(artifact?.id).toBe("art-1");
    expect(artifact?.title).toBe("Leads");
    expect(artifact?.spec.title).toBe("Leads");
    expect(artifact?.records).toEqual([]);
    // The artifact read is scoped to the OWNER carried by the share row.
    const artifactEq = calls
      .filter((c) => c.table === "artifact" && c.method === "eq")
      .map((c) => c.args);
    expect(artifactEq).toEqual(expect.arrayContaining([["user_id", "owner-1"]]));
  });

  it("returns null for an unknown token", async () => {
    resultsByTable.dashboard_share = { single: null };
    const { getSharedArtifact } = await import("@/lib/dashboards/share");
    expect(await getSharedArtifact("nope")).toBeNull();
  });

  it("returns null for an expired token (and never reads the artifact)", async () => {
    resultsByTable.dashboard_share = {
      single: {
        artifact_id: "art-1",
        user_id: "owner-1",
        expires_at: "2000-01-01T00:00:00.000Z",
      },
    };
    const { getSharedArtifact } = await import("@/lib/dashboards/share");

    expect(await getSharedArtifact("expired")).toBeNull();
    expect(calls.some((c) => c.table === "artifact")).toBe(false);
  });
});

// ─── revokeShare ──────────────────────────────────────────────────────────────

describe("revokeShare", () => {
  it("returns true when a row was deleted (owner-scoped)", async () => {
    resultsByTable.dashboard_share = { list: [{ id: "share-1" }] };
    const { revokeShare } = await import("@/lib/dashboards/share");

    expect(await revokeShare("user-1", "tok-1")).toBe(true);
    const eqArgs = calls
      .filter((c) => c.table === "dashboard_share" && c.method === "eq")
      .map((c) => c.args);
    expect(eqArgs).toEqual(
      expect.arrayContaining([
        ["user_id", "user-1"],
        ["share_token", "tok-1"],
      ]),
    );
  });

  it("returns false when no row matched", async () => {
    resultsByTable.dashboard_share = { list: [] };
    const { revokeShare } = await import("@/lib/dashboards/share");
    expect(await revokeShare("user-1", "tok-x")).toBe(false);
  });
});
