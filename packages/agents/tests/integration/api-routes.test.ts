import { Hono } from "hono";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Module mocks (must be before imports) ───

// Mock Mastra — prevents LibSQLStore from needing DATABASE_URL
vi.mock("@/mastra", () => ({
  getMastra: vi.fn(() => ({
    getAgent: vi.fn(),
    memory: {},
  })),
}));

// Mock channel webhook handlers
vi.mock("@/telegram/webhook", () => ({
  handleTelegramWebhook: vi.fn((c: any) => c.json({ ok: true })),
}));
vi.mock("@/slack/webhook", () => ({
  handleSlackWebhook: vi.fn((c: any) => c.json({ ok: true })),
}));
vi.mock("@/discord/webhook", () => ({
  handleDiscordWebhook: vi.fn((c: any) => c.json({ ok: true })),
}));

// Mock stream utilities used by conversations
vi.mock("@/lib/stream/transformer", () => ({
  createChunkTransformer: vi.fn(),
}));
vi.mock("@/lib/stream/sse", () => ({
  encodeSSE: vi.fn((data: any) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)),
  sseHeaders: vi.fn(() => ({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })),
}));

// Mock proposals lib
vi.mock("@/lib/proposals", () => ({
  default: {},
}));

// Mock external Mastra imports
vi.mock("@mastra/core/request-context", () => ({
  RequestContext: class {},
}));

// ─── Mock helpers ───

function createMockJwt(userId: string, orgId?: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      org_id: orgId,
    }),
  ).toString("base64url");
  const signature = Buffer.from("fake-signature").toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function createExpiredJwt(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    }),
  ).toString("base64url");
  const signature = Buffer.from("fake-signature").toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const AUTH_HEADER = `Bearer ${createMockJwt("test-user-1", "test-org-1")}`;

// ─── Supabase mock ───

/**
 * Build a chainable supabase-js query builder mock.
 * Resolves to { data, error } to match the supabase-js API.
 */
function createQueryBuilder(data: any = null) {
  const builder: any = {};
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "gt",
    "lt",
    "gte",
    "lte",
    "in",
    "is",
    "not",
    "or",
    "and",
    "limit",
    "order",
    "offset",
    "insert",
    "update",
    "upsert",
    "delete",
    "single",
    "maybeSingle",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // Terminal: await to get { data, error }
  const result = { data, error: null };
  // biome-ignore lint/suspicious/noThenProperty: deliberate — mock makes the Supabase query builder thenable so tests can `await builder`
  builder.then = (resolve: any) => resolve(result);
  return builder;
}

// Authed requests resolve an active workspace from public.user.default_workspace_id
// (lib/identity resolveActiveWorkspace). Default the principal row so the
// workspace-scoped routes (dashboards, stored agents) have a workspace in tests.
function defaultFrom(table: string) {
  if (table === "user") return createQueryBuilder({ default_workspace_id: "test-ws-1" });
  return createQueryBuilder();
}

const mockSupabase = {
  from: vi.fn(defaultFrom),
  auth: {
    getUser: vi.fn().mockImplementation((token: string) => {
      try {
        const parts = token.split(".");
        if (parts.length !== 3) throw new Error("Invalid JWT structure");
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return Promise.resolve({ data: { user: null }, error: { message: "JWT expired" } });
        }
        return Promise.resolve({
          data: { user: { id: "test-user-1", user_metadata: { org_id: "test-org-1" } } },
          error: null,
        });
      } catch {
        return Promise.resolve({ data: { user: null }, error: { message: "Invalid JWT" } });
      }
    }),
  },
};

vi.mock("@/lib/db", () => ({
  getSupabase: () => mockSupabase,
}));

// Mock capabilities (returns defaults: all enabled)
vi.mock("@/lib/capabilities", async () => {
  const actual: any = await vi.importActual("@/lib/capabilities");
  return {
    ...actual,
    CAPABILITIES: actual.CAPABILITIES,
    getCapabilities: vi.fn().mockResolvedValue({
      search: true,
      read: true,
      write: true,
      execute: true,
      raw_api: true,
      voice: true,
    }),
    setCapability: vi.fn().mockResolvedValue(undefined),
    checkCapability: vi.fn().mockResolvedValue(true),
  };
});

// Mock guardrails
vi.mock("@/lib/guardrails", async () => {
  const actual: any = await vi.importActual("@/lib/guardrails");
  return {
    ...actual,
    SENSITIVE_APP_CATEGORIES: actual.SENSITIVE_APP_CATEGORIES,
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    checkAppAccess: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

vi.mock("@/lib/guardrails-config", () => ({
  getOrgGuardrailConfig: () => ({
    rateLimitPerMinute: 30,
    rateLimitPerHour: 200,
    blockedApps: [],
    allowedApps: [],
    requireApprovalForWrites: false,
    maxBulkItems: 5,
  }),
}));

vi.mock("@/lib/voice", () => ({
  speechToText: vi.fn().mockResolvedValue("transcribed text"),
}));

// ─── Import routes after mocks are set up ───

const { default: routesApp } = await import("@/routes/index");

// Build a test app that mirrors the production mount
const app = new Hono();
app.route("/", routesApp);

// ─── Tests ───

describe("API route integration tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Capabilities ──────────────────────────────────────────────────────

  describe("GET /capabilities", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/capabilities");
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty("error", "Unauthorized");
    });

    it("returns capabilities with valid auth", async () => {
      const res = await app.request("/capabilities", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("capabilities");
      expect(body.capabilities).toHaveProperty("search", true);
      expect(body.capabilities).toHaveProperty("voice", true);
    });
  });

  // ── PUT /capabilities/:capability ─────────────────────────────────────

  describe("PUT /capabilities/:capability", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/capabilities/search", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(res.status).toBe(401);
    });

    it("toggles a capability and returns updated value", async () => {
      const res = await app.request("/capabilities/search", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: false }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ capability: "search", enabled: false });
    });

    it("returns 400 for unknown capability", async () => {
      const res = await app.request("/capabilities/doesnotexist", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown capability");
    });

    it("returns 400 when enabled field is missing", async () => {
      const res = await app.request("/capabilities/search", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("enabled");
    });
  });

  // ── Guardrails ────────────────────────────────────────────────────────

  describe("GET /guardrails/status", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/guardrails/status");
      expect(res.status).toBe(401);
    });

    it("returns rate limit info and app access with auth", async () => {
      const res = await app.request("/guardrails/status", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Rate limit section
      expect(body).toHaveProperty("rateLimit");
      expect(body.rateLimit).toHaveProperty("allowed", true);
      expect(body.rateLimit).toHaveProperty("limits");
      expect(body.rateLimit.limits).toHaveProperty("perMinute", 30);
      expect(body.rateLimit.limits).toHaveProperty("perHour", 200);

      // App access section
      expect(body).toHaveProperty("appAccess");
      expect(body.appAccess).toHaveProperty("banking");
      expect(body.appAccess).toHaveProperty("hr");
      expect(body.appAccess).toHaveProperty("security");

      // Config section
      expect(body).toHaveProperty("config");
      expect(body.config).toHaveProperty("requireApprovalForWrites", false);
      expect(body.config).toHaveProperty("maxBulkItems", 5);
    });
  });

  // ── PUT /guardrails/app-access/:appKey ────────────────────────────────

  describe("PUT /guardrails/app-access/:appKey", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/guardrails/app-access/stripe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(401);
    });

    it("toggles sensitive app access for a known app", async () => {
      const res = await app.request("/guardrails/app-access/stripe", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        appKey: "stripe",
        category: "banking",
        enabled: true,
      });
    });

    it("returns 400 for non-sensitive app", async () => {
      const res = await app.request("/guardrails/app-access/google-sheets", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("not a sensitive app");
    });

    it("returns 400 when enabled field is missing", async () => {
      const res = await app.request("/guardrails/app-access/stripe", {
        method: "PUT",
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("enabled");
    });
  });

  // ── Dashboards (snapshot reads) ───────────────────────────────────────

  describe("GET /dashboards/snapshots/:appKey", () => {
    const snapshotRow = {
      id: "snap-1",
      app_key: "hubspot",
      source_config: JSON.stringify({ app: "hubspot" }),
      records: JSON.stringify([{ id: "1", name: "Acme" }]),
      row_count: 1,
      refreshed_at: "2026-06-19T12:00:00.000Z",
    };

    // The auth middleware calls from("user") (ensureUserExists) before the
    // handler runs, so we can't use mockReturnValueOnce — it'd be consumed by
    // auth. Target the snapshot table by name instead, and restore the default
    // builder after each test so nothing leaks.
    function withSnapshotData(data: any) {
      mockSupabase.from.mockImplementation((t: string) =>
        t === "app_data_snapshot" ? createQueryBuilder(data) : defaultFrom(t),
      );
    }
    afterEach(() => {
      mockSupabase.from.mockImplementation(defaultFrom);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/dashboards/snapshots/hubspot");
      expect(res.status).toBe(401);
    });

    it("returns the latest snapshot with auth", async () => {
      withSnapshotData(snapshotRow);
      const res = await app.request("/dashboards/snapshots/hubspot", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id: "snap-1",
        appKey: "hubspot",
        rowCount: 1,
        records: [{ id: "1", name: "Acme" }],
        sourceConfig: { app: "hubspot" },
      });
    });

    it("returns 404 when the user has no snapshot for the app", async () => {
      // default mock builder resolves to data: null → getLatestSnapshot → null
      const res = await app.request("/dashboards/snapshots/hubspot", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(404);
    });

    it("returns the history series with ?history=true", async () => {
      withSnapshotData([snapshotRow, snapshotRow]);
      const res = await app.request("/dashboards/snapshots/hubspot?history=true", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ appKey: "hubspot", count: 2 });
      expect(Array.isArray(body.snapshots)).toBe(true);
    });

    it("returns 400 for an invalid since timestamp", async () => {
      const res = await app.request("/dashboards/snapshots/hubspot?history=true&since=notadate", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("since");
    });

    it("returns 400 for a non-numeric limit", async () => {
      const res = await app.request("/dashboards/snapshots/hubspot?history=true&limit=abc", {
        headers: { Authorization: AUTH_HEADER },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("limit");
    });
  });

  // ── Dashboards: public sharing (Phase 3) ──────────────────────────────

  describe("dashboards public sharing", () => {
    const VALID_SPEC = {
      title: "Leads",
      blocks: [{ type: "kpi", label: "Total", agg: "count" }],
    };
    const shareRow = { artifact_id: "art-1", workspace_id: "test-ws-1", expires_at: null };
    const artifactRow = {
      id: "art-1",
      kind: "dashboard",
      title: "Leads",
      spec: JSON.stringify(VALID_SPEC),
      snapshot_id: null, // no snapshot → records default to []
      updated_at: "2026-06-20T00:00:00.000Z",
    };

    // Resolve from() per-table so getSharedArtifact reads the share row then the
    // artifact row. Default (unset tables) → null builder.
    function withTables(map: Record<string, any>) {
      mockSupabase.from.mockImplementation((t: string) =>
        map[t] !== undefined ? createQueryBuilder(map[t]) : defaultFrom(t),
      );
    }
    afterEach(() => {
      mockSupabase.from.mockImplementation(defaultFrom);
    });

    it("GET /dashboards/public/:token returns 200 WITHOUT auth (token is the grant)", async () => {
      withTables({ dashboard_share: shareRow, artifact: artifactRow });
      // Deliberately NO Authorization header — the public carve-out must allow it.
      const res = await app.request("/dashboards/public/sometoken");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: "art-1", title: "Leads", records: [] });
      expect(body.spec.title).toBe("Leads");
    });

    it("GET /dashboards/public/:token returns 404 for an unknown token", async () => {
      // default builder → dashboard_share lookup is null → getSharedArtifact null
      const res = await app.request("/dashboards/public/nope");
      expect(res.status).toBe(404);
    });

    it("POST /dashboards/artifacts/:id/share still requires auth (401)", async () => {
      const res = await app.request("/dashboards/artifacts/art-1/share", { method: "POST" });
      expect(res.status).toBe(401);
    });
  });

  // ── Voice ─────────────────────────────────────────────────────────────

  describe("POST /voice/transcribe", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/voice/transcribe", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Auth edge cases ───────────────────────────────────────────────────

  describe("Auth edge cases", () => {
    it("rejects expired JWT", async () => {
      const expiredToken = createExpiredJwt("test-user-1");
      const res = await app.request("/capabilities", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
    });

    it("rejects malformed bearer token", async () => {
      const res = await app.request("/capabilities", {
        headers: { Authorization: "Bearer not.a.valid.jwt" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects completely invalid auth header", async () => {
      const res = await app.request("/capabilities", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(res.status).toBe(401);
    });
  });
});

// ── Health endpoint (webhook server on port 4112) ───────────────────────

describe("Health endpoint", () => {
  const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:4112";

  let reachable = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${WEBHOOK_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      console.warn(`\n⚠  Webhook server not reachable at ${WEBHOOK_URL}. Skipping health tests.\n`);
    }
  });

  it("GET /health returns { status: 'ok' }", async ({ skip }) => {
    if (!reachable) skip();

    const res = await fetch(`${WEBHOOK_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
