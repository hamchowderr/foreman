import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock ───

let nextResult: any = { data: null, error: null };

function createChain() {
  const builder: any = {};
  for (const m of ["select", "eq", "limit", "upsert"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(nextResult));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => resolve(nextResult);
  return builder;
}

const mockSupabase = {
  from: vi.fn(() => createChain()),
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

describe("capabilities", () => {
  beforeEach(() => {
    vi.resetModules();
    nextResult = { data: null, error: null };
  });

  describe("CAPABILITIES", () => {
    it("contains all 6 standard capabilities", async () => {
      const { CAPABILITIES } = await import("@/lib/capabilities");
      expect(CAPABILITIES).toHaveLength(6);
      expect(CAPABILITIES).toContain("search");
      expect(CAPABILITIES).toContain("read");
      expect(CAPABILITIES).toContain("write");
      expect(CAPABILITIES).toContain("execute");
      expect(CAPABILITIES).toContain("raw_api");
      expect(CAPABILITIES).toContain("voice");
    });
  });

  describe("getCapabilities", () => {
    it("returns all standard capabilities defaulting to true when no DB rows", async () => {
      nextResult = { data: [], error: null };

      const { getCapabilities } = await import("@/lib/capabilities");
      const caps = await getCapabilities("user-1");

      expect(caps.search).toBe(true);
      expect(caps.read).toBe(true);
      expect(caps.write).toBe(true);
      expect(caps.execute).toBe(true);
      expect(caps.raw_api).toBe(true);
      expect(caps.voice).toBe(true);
    });

    it("overrides defaults with DB values", async () => {
      nextResult = {
        data: [
          { capability: "voice", enabled: false },
          { capability: "raw_api", enabled: false },
        ],
        error: null,
      };

      const { getCapabilities } = await import("@/lib/capabilities");
      const caps = await getCapabilities("user-1");

      expect(caps.voice).toBe(false);
      expect(caps.raw_api).toBe(false);
      expect(caps.search).toBe(true);
    });
  });

  describe("setCapability", () => {
    it("inserts/upserts a capability flag", async () => {
      nextResult = { data: null, error: null };

      const { setCapability } = await import("@/lib/capabilities");
      await expect(setCapability("user-1", "voice", false)).resolves.toBeUndefined();
    });
  });

  describe("checkCapability", () => {
    it("returns true when no row exists (default-on)", async () => {
      nextResult = { data: null, error: null };

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "search");
      expect(result).toBe(true);
    });

    it("returns false when explicitly disabled", async () => {
      nextResult = { data: { enabled: false }, error: null };

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "voice");
      expect(result).toBe(false);
    });

    it("returns true when explicitly enabled", async () => {
      nextResult = { data: { enabled: true }, error: null };

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "write");
      expect(result).toBe(true);
    });
  });
});
