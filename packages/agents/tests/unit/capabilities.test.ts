import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("@/lib/db", () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();

  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    onConflictDoUpdate: mockOnConflictDoUpdate,
  };

  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockValues.mockReturnValue(chain);
  mockOnConflictDoUpdate.mockResolvedValue(undefined);

  return {
    getDb: () => chain,
    schema: {
      capabilityFlag: {
        userId: "userId",
        capability: "capability",
        enabled: "enabled",
      },
    },
    __mocks: { mockWhere, mockFrom, mockLimit, mockOnConflictDoUpdate },
  };
});

describe("capabilities", () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.resetModules();
    const dbModule = await import("@/lib/db");
    mockDb = (dbModule as any).__mocks;
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
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      // Return empty array (no rows in DB)
      db.where.mockResolvedValueOnce([]);

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
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      db.where.mockResolvedValueOnce([
        { userId: "user-1", capability: "voice", enabled: false },
        { userId: "user-1", capability: "raw_api", enabled: false },
      ]);

      const { getCapabilities } = await import("@/lib/capabilities");
      const caps = await getCapabilities("user-1");

      expect(caps.voice).toBe(false);
      expect(caps.raw_api).toBe(false);
      expect(caps.search).toBe(true);
    });
  });

  describe("setCapability", () => {
    it("inserts/upserts a capability flag", async () => {
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      db.onConflictDoUpdate.mockResolvedValueOnce(undefined);

      const { setCapability } = await import("@/lib/capabilities");
      await expect(setCapability("user-1", "voice", false)).resolves.toBeUndefined();
    });
  });

  describe("checkCapability", () => {
    it("returns true when no row exists (default-on)", async () => {
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      db.limit.mockResolvedValueOnce([]);

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "search");
      expect(result).toBe(true);
    });

    it("returns false when explicitly disabled", async () => {
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      db.limit.mockResolvedValueOnce([
        { userId: "user-1", capability: "voice", enabled: false },
      ]);

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "voice");
      expect(result).toBe(false);
    });

    it("returns true when explicitly enabled", async () => {
      const dbModule = await import("@/lib/db");
      const db = (dbModule as any).getDb();
      db.limit.mockResolvedValueOnce([
        { userId: "user-1", capability: "write", enabled: true },
      ]);

      const { checkCapability } = await import("@/lib/capabilities");
      const result = await checkCapability("user-1", "write");
      expect(result).toBe(true);
    });
  });
});
