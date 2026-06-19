/**
 * Unit tests for the dashboards snapshot lib — the append-only save path and the
 * latest/history reads. No network: getSupabase is mocked; we assert the row
 * shape that gets inserted (JSON-as-text, row_count) and that reads parse the
 * stored JSON back into Snapshot objects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const inserts: { table: string; payload: any }[] = [];
// What select chains resolve to (both the thenable and maybeSingle).
let selectResult: { data: any; error: any } = { data: null, error: null };
let insertResult: { error: { message: string } | null } = { error: null };
// Captured filter args so we can assert scoping (user_id, app_key) + gte(since).
const filters: { method: string; args: any[] }[] = [];

function createChain(table: string) {
  const builder: any = {};
  for (const m of ["select", "eq", "order", "limit", "gte"]) {
    builder[m] = vi.fn((...args: any[]) => {
      filters.push({ method: m, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(selectResult));
  builder.insert = vi.fn((payload: any) => {
    inserts.push({ table, payload });
    return Promise.resolve(insertResult);
  });
  // Awaiting the builder directly (history query) resolves to the select result.
  // biome-ignore lint/suspicious/noThenProperty: thenable mock
  builder.then = (resolve: any) => resolve(selectResult);
  return builder;
}

const mockSupabase = { from: vi.fn((t: string) => createChain(t)) };
vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

beforeEach(() => {
  inserts.length = 0;
  filters.length = 0;
  selectResult = { data: null, error: null };
  insertResult = { error: null };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── saveSnapshot ──────────────────────────────────────────────────────────────

describe("saveSnapshot", () => {
  it("inserts one append-only row with JSON-as-text payloads and a row_count", async () => {
    const { saveSnapshot } = await import("@/lib/dashboards/snapshot");
    const records = [
      { id: "1", name: "Acme" },
      { id: "2", name: "Globex" },
    ];

    const id = await saveSnapshot({
      userId: "user-1",
      appKey: "hubspot",
      sourceConfig: { app: "hubspot", action: "new_contact" },
      records,
      triggerId: "trig-1",
    });

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(inserts).toHaveLength(1);

    const row = inserts[0].payload;
    expect(inserts[0].table).toBe("app_data_snapshot");
    expect(row.id).toBe(id);
    expect(row.user_id).toBe("user-1");
    expect(row.app_key).toBe("hubspot");
    expect(row.trigger_id).toBe("trig-1");
    expect(row.row_count).toBe(2);
    // JSON stored as text — parses back to the originals.
    expect(JSON.parse(row.records)).toEqual(records);
    expect(JSON.parse(row.source_config)).toEqual({ app: "hubspot", action: "new_contact" });
    // refreshed_at + created_at are set by the lib.
    expect(typeof row.refreshed_at).toBe("string");
    expect(row.created_at).toBe(row.refreshed_at);
  });

  it("defaults workspace_id and trigger_id to null and row_count to 0 for empty records", async () => {
    const { saveSnapshot } = await import("@/lib/dashboards/snapshot");

    await saveSnapshot({
      userId: "user-1",
      appKey: "airtable",
      sourceConfig: {},
      records: [],
    });

    const row = inserts[0].payload;
    expect(row.workspace_id).toBeNull();
    expect(row.trigger_id).toBeNull();
    expect(row.row_count).toBe(0);
    expect(JSON.parse(row.records)).toEqual([]);
  });

  it("throws when the insert returns an error", async () => {
    insertResult = { error: { message: "boom" } };
    const { saveSnapshot } = await import("@/lib/dashboards/snapshot");

    await expect(
      saveSnapshot({ userId: "u", appKey: "a", sourceConfig: {}, records: [] }),
    ).rejects.toThrow(/saveSnapshot failed: boom/);
  });
});

// ─── getLatestSnapshot ──────────────────────────────────────────────────────────

describe("getLatestSnapshot", () => {
  it("returns the parsed latest snapshot scoped to (user_id, app_key)", async () => {
    selectResult = {
      data: {
        id: "snap-1",
        app_key: "hubspot",
        source_config: JSON.stringify({ app: "hubspot" }),
        records: JSON.stringify([{ id: "1" }]),
        row_count: 1,
        refreshed_at: "2026-06-19T12:00:00.000Z",
      },
      error: null,
    };
    const { getLatestSnapshot } = await import("@/lib/dashboards/snapshot");

    const snap = await getLatestSnapshot("user-1", "hubspot");

    expect(snap).toEqual({
      id: "snap-1",
      appKey: "hubspot",
      sourceConfig: { app: "hubspot" },
      records: [{ id: "1" }],
      rowCount: 1,
      refreshedAt: "2026-06-19T12:00:00.000Z",
    });
    // Scoped by both user_id and app_key.
    const eqArgs = filters.filter((f) => f.method === "eq").map((f) => f.args);
    expect(eqArgs).toEqual(
      expect.arrayContaining([
        ["user_id", "user-1"],
        ["app_key", "hubspot"],
      ]),
    );
  });

  it("returns null when no snapshot exists", async () => {
    selectResult = { data: null, error: null };
    const { getLatestSnapshot } = await import("@/lib/dashboards/snapshot");

    expect(await getLatestSnapshot("user-1", "hubspot")).toBeNull();
  });

  it("tolerates corrupt stored JSON (records default to [])", async () => {
    selectResult = {
      data: {
        id: "snap-x",
        app_key: "hubspot",
        source_config: "not json{",
        records: "also not json[",
        row_count: 0,
        refreshed_at: "2026-06-19T12:00:00.000Z",
      },
      error: null,
    };
    const { getLatestSnapshot } = await import("@/lib/dashboards/snapshot");

    const snap = await getLatestSnapshot("user-1", "hubspot");
    expect(snap?.records).toEqual([]);
    expect(snap?.sourceConfig).toBeNull();
  });
});

// ─── getSnapshotHistory ─────────────────────────────────────────────────────────

describe("getSnapshotHistory", () => {
  it("maps a series of rows newest-first and applies the since filter", async () => {
    selectResult = {
      data: [
        {
          id: "snap-2",
          app_key: "hubspot",
          source_config: "{}",
          records: JSON.stringify([{ id: "2" }]),
          row_count: 1,
          refreshed_at: "2026-06-19T13:00:00.000Z",
        },
        {
          id: "snap-1",
          app_key: "hubspot",
          source_config: "{}",
          records: JSON.stringify([{ id: "1" }]),
          row_count: 1,
          refreshed_at: "2026-06-19T12:00:00.000Z",
        },
      ],
      error: null,
    };
    const { getSnapshotHistory } = await import("@/lib/dashboards/snapshot");

    const series = await getSnapshotHistory("user-1", "hubspot", {
      since: "2026-06-19T00:00:00.000Z",
    });

    expect(series).toHaveLength(2);
    expect(series.map((s) => s.id)).toEqual(["snap-2", "snap-1"]);
    expect(series[0].records).toEqual([{ id: "2" }]);
    // since → gte("refreshed_at", ...)
    const gte = filters.find((f) => f.method === "gte");
    expect(gte?.args).toEqual(["refreshed_at", "2026-06-19T00:00:00.000Z"]);
  });

  it("returns [] when there are no rows and does not call gte without since", async () => {
    selectResult = { data: null, error: null };
    const { getSnapshotHistory } = await import("@/lib/dashboards/snapshot");

    const series = await getSnapshotHistory("user-1", "hubspot");
    expect(series).toEqual([]);
    expect(filters.some((f) => f.method === "gte")).toBe(false);
  });
});
