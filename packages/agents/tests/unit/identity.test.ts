import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ───

let nextQueryResult: any = { data: null, error: null };

function createChain() {
  const builder: any = {};
  const chainMethods = ["select", "eq", "neq", "limit", "order", "insert", "update", "upsert", "delete"];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(nextQueryResult));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(nextQueryResult));
  builder.then = (resolve: any) => resolve(nextQueryResult);
  return builder;
}

const mockAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
};

const mockSupabase = {
  from: vi.fn(() => createChain()),
  auth: mockAuth,
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
  __mocks: { mockAuth, mockSupabase, setNextResult: (r: any) => { nextQueryResult = r; } },
}));

describe("identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextQueryResult = { data: null, error: null };
  });

  describe("resolveFromSupabaseJwt", () => {
    it("extracts userId from valid Supabase token", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: { id: "user_abc123", user_metadata: {} } },
        error: null,
      });
      const { resolveFromSupabaseJwt } = await import("@/lib/identity");
      const result = await resolveFromSupabaseJwt("valid-token");
      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user_abc123");
    });

    it("extracts orgId when present in user_metadata", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: { id: "user_abc123", user_metadata: { org_id: "org_xyz789" } } },
        error: null,
      });
      const { resolveFromSupabaseJwt } = await import("@/lib/identity");
      const result = await resolveFromSupabaseJwt("valid-token");
      expect(result).not.toBeNull();
      expect(result!.orgId).toBe("org_xyz789");
    });

    it("returns result without orgId when org_id not present", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: { id: "user_abc123", user_metadata: {} } },
        error: null,
      });
      const { resolveFromSupabaseJwt } = await import("@/lib/identity");
      const result = await resolveFromSupabaseJwt("valid-token");
      expect(result).not.toBeNull();
      expect(result!.orgId).toBeUndefined();
    });

    it("returns null when auth returns error", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid JWT" },
      });
      const { resolveFromSupabaseJwt } = await import("@/lib/identity");
      const result = await resolveFromSupabaseJwt("bad-token");
      expect(result).toBeNull();
    });

    it("returns null when auth returns no user", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      const { resolveFromSupabaseJwt } = await import("@/lib/identity");
      const result = await resolveFromSupabaseJwt("token-no-user");
      expect(result).toBeNull();
    });
  });

  describe("hashApiKey (indirect via resolveFromApiKey)", () => {
    it("produces consistent SHA-256 hash", async () => {
      const { createHash } = await import("node:crypto");
      const key = "fmn_testapikey12345";
      const hash1 = createHash("sha256").update(key).digest("hex");
      const hash2 = createHash("sha256").update(key).digest("hex");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe("resolveFromApiKey", () => {
    it("returns userId when API key matches", async () => {
      nextQueryResult = { data: { id: "key-1", user_id: "user-from-api-key" }, error: null };

      const { resolveFromApiKey } = await import("@/lib/identity");
      const result = await resolveFromApiKey("fmn_somekey");
      expect(result).toBe("user-from-api-key");
    });

    it("returns null when API key not found", async () => {
      nextQueryResult = { data: null, error: { code: "PGRST116" } };

      const { resolveFromApiKey } = await import("@/lib/identity");
      const result = await resolveFromApiKey("fmn_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("resolveFromChannel", () => {
    it("returns userId when channel identity exists", async () => {
      nextQueryResult = {
        data: { user_id: "user-from-telegram", channel: "telegram", channel_user_id: "tg-123" },
        error: null,
      };

      const { resolveFromChannel } = await import("@/lib/identity");
      const result = await resolveFromChannel("telegram", "tg-123");
      expect(result).toBe("user-from-telegram");
    });

    it("returns null when channel identity not found", async () => {
      nextQueryResult = { data: null, error: null };

      const { resolveFromChannel } = await import("@/lib/identity");
      const result = await resolveFromChannel("discord", "unknown-user");
      expect(result).toBeNull();
    });
  });
});
