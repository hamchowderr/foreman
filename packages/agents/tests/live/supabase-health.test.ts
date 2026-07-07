import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";

/**
 * Live Supabase integration tests.
 *
 * Requires:
 *   npx supabase start                 # local Supabase on :54421
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *
 * Auto-skips if Supabase is not reachable.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function supabaseIsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

describe("Supabase live integration", () => {
  let reachable = false;
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(async () => {
    reachable = await supabaseIsReachable();
    if (!reachable) {
      console.warn(
        `\n⚠  Supabase not reachable at ${SUPABASE_URL}. Skipping live tests.\n` +
          `   Start it with: npx supabase start\n`,
      );
      return;
    }
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  });

  describe("DB connectivity", () => {
    it("can connect and query the user table", async ({ skip }) => {
      if (!reachable) skip();
      const { error } = await supabase.from("user").select("id").limit(1);
      expect(error).toBeNull();
    });

    it("can query capability_flag table", async ({ skip }) => {
      if (!reachable) skip();
      const { error } = await supabase.from("capability_flag").select("*").limit(1);
      expect(error).toBeNull();
    });

    it("can query conversation table", async ({ skip }) => {
      if (!reachable) skip();
      const { error } = await supabase.from("conversation").select("*").limit(1);
      expect(error).toBeNull();
    });

    it("can query automation table", async ({ skip }) => {
      if (!reachable) skip();
      const { error } = await supabase.from("automation").select("*").limit(1);
      expect(error).toBeNull();
    });
  });

  describe("capability_flag CRUD", () => {
    const testUserId = `live-test-user-${Date.now()}`;

    it("can upsert and read a capability flag", async ({ skip }) => {
      if (!reachable) skip();

      // Write
      const { error: writeErr } = await supabase
        .from("capability_flag")
        .upsert(
          { user_id: testUserId, capability: "voice", enabled: false },
          { onConflict: "user_id,capability" },
        );
      expect(writeErr).toBeNull();

      // Read
      const { data, error: readErr } = await supabase
        .from("capability_flag")
        .select("enabled")
        .eq("user_id", testUserId)
        .eq("capability", "voice")
        .limit(1)
        .single();

      expect(readErr).toBeNull();
      expect(data?.enabled).toBe(false);

      // Cleanup
      await supabase.from("capability_flag").delete().eq("user_id", testUserId);
    });
  });

  describe("identity resolution (live)", () => {
    it("resolveFromApiKey returns null for non-existent key", async ({ skip }) => {
      if (!reachable) skip();

      // Load .env.local so getSupabase() uses the right URL
      const { resolveFromApiKey } = await import("@/lib/identity");
      const result = await resolveFromApiKey("fmn_nonexistent_key_live_test");
      expect(result).toBeNull();
    });
  });
});
