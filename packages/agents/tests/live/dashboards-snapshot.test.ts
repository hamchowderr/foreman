import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLatestSnapshot, getSnapshotHistory, saveSnapshot } from "@/lib/dashboards/snapshot";
import { getSupabase } from "@/lib/db";

/**
 * Live Supabase round-trip for the dashboards snapshot lib.
 *
 * Unlike the mocked unit tests (tests/unit/dashboards-snapshot.test.ts), this
 * drives the REAL lib against the REAL migrated `app_data_snapshot` table — so
 * it proves what mocks can't: the actual column names, NOT NULL constraints, the
 * JSON-as-text round-trip through Postgres, and refreshed_at DESC ordering.
 *
 * Requires:
 *   npx supabase start                 # local Supabase on :54421
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local (loaded by test:live)
 *
 * Auto-skips if Supabase is not reachable. Run: npm run test:live
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";

async function supabaseIsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" },
      signal: AbortSignal.timeout(2000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

describe("dashboards snapshot — live Supabase round-trip", () => {
  let reachable = false;
  const testUserId = `live-test-dash-${Date.now()}`;
  const appKey = "hubspot";

  beforeAll(async () => {
    reachable = await supabaseIsReachable();
    if (!reachable) {
      console.warn(
        `\n⚠  Supabase not reachable at ${SUPABASE_URL}. Skipping live snapshot tests.\n` +
          `   Start it with: npx supabase start\n`,
      );
    }
  });

  afterAll(async () => {
    if (!reachable) return;
    // Cleanup: remove every row this test wrote.
    await getSupabase().from("app_data_snapshot").delete().eq("user_id", testUserId);
  });

  it("saves a snapshot and reads it back with JSON payloads intact", async ({ skip }) => {
    if (!reachable) skip();

    const records = [
      { id: "1", name: "Acme", value: 42 },
      { id: "2", name: "Globex", value: 7 },
    ];
    const sourceConfig = { app: appKey, action: "new_contact", inputs: { limit: 100 } };

    const id = await saveSnapshot({
      userId: testUserId,
      appKey,
      sourceConfig,
      records,
      triggerId: "live-trig-1",
    });
    expect(id).toBeTruthy();

    const latest = await getLatestSnapshot(testUserId, appKey);
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(id);
    expect(latest?.appKey).toBe(appKey);
    expect(latest?.rowCount).toBe(2);
    // JSON-as-text survives the Postgres round-trip exactly.
    expect(latest?.records).toEqual(records);
    expect(latest?.sourceConfig).toEqual(sourceConfig);
    expect(typeof latest?.refreshedAt).toBe("string");
  });

  it("is append-only: a second save returns as the latest, history keeps both newest-first", async ({
    skip,
  }) => {
    if (!reachable) skip();

    // A timestamp strictly between the two saves — robust for the `since` filter
    // regardless of how close the two refreshed_at values land.
    const between = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 5));

    const id2 = await saveSnapshot({
      userId: testUserId,
      appKey,
      sourceConfig: { app: appKey, action: "new_contact" },
      records: [{ id: "3", name: "Initech" }],
    });

    // Latest is now the second snapshot (append-only, not an upsert).
    const latest = await getLatestSnapshot(testUserId, appKey);
    expect(latest?.id).toBe(id2);
    expect(latest?.rowCount).toBe(1);

    // Full history has both rows, newest first.
    const all = await getSnapshotHistory(testUserId, appKey);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all[0].id).toBe(id2);

    // since filter returns only the newer snapshot.
    const recent = await getSnapshotHistory(testUserId, appKey, { since: between });
    expect(recent.map((s) => s.id)).toContain(id2);
    expect(recent.map((s) => s.id)).not.toContain(all[all.length - 1].id);
  });

  it("returns null for an app the user has no snapshots for", async ({ skip }) => {
    if (!reachable) skip();
    expect(await getLatestSnapshot(testUserId, "no-such-app")).toBeNull();
    expect(await getSnapshotHistory(testUserId, "no-such-app")).toEqual([]);
  });
});
