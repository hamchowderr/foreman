import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the capabilities module (used by checkAppAccess)
vi.mock("@/lib/capabilities", () => ({
  checkCapability: vi.fn().mockResolvedValue(true),
}));

// ─── Supabase mock ───

let nextSensitiveResult: any = { data: null, error: null };

function createChain() {
  const builder: any = {};
  for (const m of ["select", "eq", "limit"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(nextSensitiveResult));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => resolve(nextSensitiveResult);
  return builder;
}

const mockSupabase = {
  from: vi.fn(() => createChain()),
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

describe("guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextSensitiveResult = { data: null, error: null };
  });

  describe("checkRateLimit", () => {
    it("allows requests under the limit", async () => {
      const { checkRateLimit } = await import("@/lib/guardrails");
      const result = await checkRateLimit("rate-test-user-1");
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it("blocks requests over the minute limit and returns retryAfterMs", async () => {
      const { checkRateLimit } = await import("@/lib/guardrails");
      const userId = "rate-test-user-2";

      // Exhaust the minute limit (default 30)
      for (let i = 0; i < 30; i++) {
        await checkRateLimit(userId);
      }

      const result = await checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("respects custom limits", async () => {
      const { checkRateLimit } = await import("@/lib/guardrails");
      const userId = "rate-test-user-3";

      // Use a very low custom limit
      for (let i = 0; i < 2; i++) {
        await checkRateLimit(userId, { perMinute: 2 });
      }

      const result = await checkRateLimit(userId, { perMinute: 2 });
      expect(result.allowed).toBe(false);
    });
  });

  describe("checkAppAccess", () => {
    it("blocks sensitive apps by default (no capability row)", async () => {
      // nextSensitiveResult = { data: null } → checkSensitiveAppCapability returns false
      const { checkAppAccess } = await import("@/lib/guardrails");
      const result = await checkAppAccess("user-1", "stripe");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("banking");
    });

    it("allows non-sensitive apps", async () => {
      const { checkAppAccess } = await import("@/lib/guardrails");
      const result = await checkAppAccess("user-1", "google_calendar");
      expect(result.allowed).toBe(true);
    });
  });
});
