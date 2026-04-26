import { describe, it, expect, vi, beforeEach } from "vitest";

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

  describe("assessActionRisk", () => {
    it('returns "low" for search/read actions', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const result = assessActionRisk("search", "GoogleCalendar.find_events", {});
      expect(result.level).toBe("low");
      expect(result.requiresConfirmation).toBe(false);
    });

    it('returns "medium" for write actions', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const result = assessActionRisk("write", "GoogleSheets.create_row", {
        data: "test",
      });
      expect(result.level).toBe("medium");
    });

    it('returns "high" for bulk writes (>10 items)', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const items = Array.from({ length: 15 }, (_, i) => ({ id: i }));
      const result = assessActionRisk("write", "GoogleSheets.create_row", {
        rows: items,
      });
      expect(result.level).toBe("high");
      expect(result.requiresConfirmation).toBe(true);
    });

    it('returns "critical" for delete actions', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const result = assessActionRisk("write", "GoogleSheets.delete_row", {});
      expect(result.level).toBe("critical");
      expect(result.requiresConfirmation).toBe(true);
    });

    it('returns "high" for raw_api actions', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const result = assessActionRisk("raw_api", "CustomApp.raw_request", {});
      expect(result.level).toBe("high");
      expect(result.requiresConfirmation).toBe(true);
    });

    it('returns "high" for run actions', async () => {
      const { assessActionRisk } = await import("@/lib/guardrails");
      const result = assessActionRisk("run", "Zapier.run_action", {});
      expect(result.level).toBe("high");
      expect(result.requiresConfirmation).toBe(true);
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

  describe("needsBulkConfirmation", () => {
    it("returns true for arrays > 5 items (default threshold)", async () => {
      const { needsBulkConfirmation } = await import("@/lib/guardrails");
      const result = needsBulkConfirmation({
        items: [1, 2, 3, 4, 5, 6],
      });
      expect(result).toBe(true);
    });

    it("returns false for arrays <= 5 items", async () => {
      const { needsBulkConfirmation } = await import("@/lib/guardrails");
      const result = needsBulkConfirmation({
        items: [1, 2, 3],
      });
      expect(result).toBe(false);
    });

    it("returns false when no arrays in inputs", async () => {
      const { needsBulkConfirmation } = await import("@/lib/guardrails");
      const result = needsBulkConfirmation({ name: "test" });
      expect(result).toBe(false);
    });

    it("respects custom threshold", async () => {
      const { needsBulkConfirmation } = await import("@/lib/guardrails");
      const result = needsBulkConfirmation({ items: [1, 2, 3] }, 2);
      expect(result).toBe(true);
    });
  });

  describe("runGuardrails", () => {
    it("combines rate limit, app access, and risk checks", async () => {
      const { runGuardrails } = await import("@/lib/guardrails");
      const result = await runGuardrails(
        "guardrail-test-user",
        "google_calendar",
        "search",
        "GoogleCalendar.find_events",
        {}
      );
      expect(result.allowed).toBe(true);
      expect(result.risk).toBeDefined();
      expect(result.risk!.level).toBe("low");
      expect(result.requiresConfirmation).toBe(false);
    });

    it("blocks when rate limited", async () => {
      const { runGuardrails, checkRateLimit } = await import(
        "@/lib/guardrails"
      );
      const userId = "guardrail-rate-limited-user";

      // Exhaust rate limit
      for (let i = 0; i < 30; i++) {
        await checkRateLimit(userId);
      }

      const result = await runGuardrails(
        userId,
        "google_calendar",
        "search",
        "GoogleCalendar.find_events",
        {}
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Rate limit");
    });

    it("requires confirmation for bulk + risky actions", async () => {
      const { runGuardrails } = await import("@/lib/guardrails");
      const items = Array.from({ length: 6 }, (_, i) => i);
      const result = await runGuardrails(
        "guardrail-bulk-user",
        "google_sheets",
        "write",
        "GoogleSheets.create_row",
        { rows: items }
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });
  });
});
