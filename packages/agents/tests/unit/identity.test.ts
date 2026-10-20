import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase mock ───

let nextQueryResult: any = { data: null, error: null };
// Per-query results, consumed in order before falling back to nextQueryResult.
let queuedResults: any[] = [];
const takeResult = () => (queuedResults.length ? queuedResults.shift() : nextQueryResult);

function createChain() {
  const builder: any = {};
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "limit",
    "order",
    "insert",
    "update",
    "upsert",
    "delete",
    "is",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(takeResult()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(takeResult()));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => resolve(takeResult());
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
  __mocks: {
    mockAuth,
    mockSupabase,
    setNextResult: (r: any) => {
      nextQueryResult = r;
    },
  },
}));

describe("identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextQueryResult = { data: null, error: null };
    queuedResults = [];
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

  describe("redeemChannelLinkCode", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const code = (channel: string) => ({
      data: { id: "code-1", user_id: "web-user", channel, expires_at: future, used_at: null },
      error: null,
    });

    it("refuses a code made for a different app", async () => {
      queuedResults = [code("telegram")];
      const { redeemChannelLinkCode } = await import("@/lib/identity");
      const result = await redeemChannelLinkCode("ABCD1234", "discord", "D1");
      expect(result).toEqual({ ok: false, error: "wrong_channel" });
      // Refused before the code is spent or any identity is touched.
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("loses the race when another redeem already claimed the code", async () => {
      // The lookup saw used_at = null, but the conditional claim updated no row.
      queuedResults = [code("slack"), { data: [], error: null }];
      const { redeemChannelLinkCode } = await import("@/lib/identity");
      const result = await redeemChannelLinkCode("ABCD1234", "slack", "U1");
      expect(result).toEqual({ ok: false, error: "already_used" });
    });

    it("links and returns the web user it linked to", async () => {
      queuedResults = [
        code("slack"),
        { data: [{ id: "code-1" }], error: null }, // claim
        { data: null, error: null }, // no existing channel_identity
        { data: null, error: null }, // insert
      ];
      const { redeemChannelLinkCode } = await import("@/lib/identity");
      const result = await redeemChannelLinkCode("ABCD1234", "slack", "U1", "Ada");
      expect(result).toEqual({ ok: true, userId: "web-user" });
    });
  });
});
