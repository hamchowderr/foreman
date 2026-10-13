/**
 * Workspace shared Zapier connections: which account a member's calls run on,
 * whose connection aliases ride along, and what `GET /zapier/status` reports.
 *
 * A connection id only exists inside the Zapier account that owns it, so a
 * member running on the workspace's shared connection must get the OWNER's
 * aliases — their own would point at connections in a different account.
 *
 * No network and no real keys: DB, env, crypto, identity and the SDK factory are
 * mocked. The DB stub answers by table and by the `.eq()` filters applied.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mode: "member-first" as string | null,
  identities: [] as Array<{ id: string; user_id: string; workspace_id: string | null }>,
  loadUserConnectionsMap: vi.fn(async (_owner: string) => ({})),
}));

vi.mock("@zapier/zapier-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zapier/zapier-sdk")>();
  return { ...actual, createZapierSdk: vi.fn((options: unknown) => ({ __options: options })) };
});
vi.mock("@zapier/zapier-sdk/experimental", () => ({
  createZapierSdk: vi.fn((options: unknown) => ({ __options: options })),
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ FOREMAN_MODE: "production" }) }));
vi.mock("@/lib/crypto", () => ({
  decryptToken: (v: string) => v,
  encryptToken: (v: string) => v,
}));
vi.mock("@/lib/identity", () => ({
  resolveActiveWorkspace: vi.fn(async () => "ws-1"),
  resolveFromSupabaseJwt: vi.fn(async (token: string) => ({ userId: token })),
  ensureUserExists: vi.fn(),
}));
vi.mock("@/lib/zapier/aliases", () => ({ loadUserConnectionsMap: h.loadUserConnectionsMap }));
vi.mock("@/lib/db", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const chain: any = {
        select: () => chain,
        limit: () => chain,
        update: () => chain,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return chain;
        },
        maybeSingle: async () => {
          if (table === "workspace_settings") {
            return { data: h.mode ? { zapier_connection_mode: h.mode } : null };
          }
          const row = h.identities.find((r) =>
            Object.entries(filters).every(([k, v]) => r[k as keyof typeof r] === v),
          );
          return {
            data: row
              ? { ...row, access_token: "tok", refresh_token: "ref", expires_at: null }
              : null,
          };
        },
      };
      return chain;
    },
  }),
}));

import { getSdkForUser, resolveZapierIdentity } from "@/lib/zapier/sdk";
import zapierConnect from "@/routes/zapier-connect";

const OWNER = { id: "zi-owner", user_id: "owner-1", workspace_id: "ws-1" };
const MEMBER_OWN = { id: "zi-member", user_id: "member-1", workspace_id: null };

async function status(userId: string) {
  const res = await zapierConnect.request("/status", {
    headers: { Authorization: `Bearer ${userId}` },
  });
  return res.json();
}

describe("shared Zapier connections", () => {
  beforeEach(() => {
    h.loadUserConnectionsMap.mockClear();
  });

  it("runs a member without their own connection on the workspace's shared one", async () => {
    h.mode = "member-first";
    h.identities = [OWNER];
    expect((await resolveZapierIdentity("member-1"))?.id).toBe("zi-owner");
  });

  it("loads the shared connection owner's aliases, not the member's", async () => {
    h.mode = "shared";
    h.identities = [OWNER, MEMBER_OWN];
    await getSdkForUser("member-shared-mode");
    expect(h.loadUserConnectionsMap).toHaveBeenCalledWith("owner-1");
  });

  it("keeps a member on their own aliases when they run on their own connection", async () => {
    h.mode = "member-first";
    h.identities = [OWNER, MEMBER_OWN];
    await getSdkForUser("member-1");
    expect(h.loadUserConnectionsMap).toHaveBeenCalledWith("member-1");
  });

  it("reports a member on the shared connection as connected, and says it's shared", async () => {
    h.mode = "member-first";
    h.identities = [OWNER];
    expect(await status("member-1")).toEqual({ connected: true, shared: true });
  });

  it("reports the member's own connection as not shared", async () => {
    h.mode = "member-first";
    h.identities = [OWNER, MEMBER_OWN];
    expect(await status("member-1")).toEqual({ connected: true, shared: false });
  });

  it("reports not connected when personal mode leaves nothing to run on", async () => {
    h.mode = "personal";
    h.identities = [OWNER];
    expect(await status("member-1")).toEqual({ connected: false, shared: false });
  }, 10_000);
});
