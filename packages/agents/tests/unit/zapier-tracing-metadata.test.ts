/**
 * Zapier SDK 0.105–0.115 adoption: request tracing (correlation/causation ids),
 * the terminal `approval_token_invalid` approval status, `is_managed` /
 * `permissions` / `meta.id` surviving the result summarizer, and the
 * admin-restricted (`permissions.can_use === false`) run-action denial.
 *
 * No network and no real keys: the per-user SDK factory, DB, env and crypto are
 * mocked; the summarizer and guardrail store are pure.
 */
import { RequestContext } from "@mastra/core/request-context";
import { ZapierApprovalError } from "@zapier/zapier-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks for lib/zapier/sdk.ts ─────────────────────────────────────────────
// `vi.hoisted` so the factories below can reference these.
const h = vi.hoisted(() => ({
  createZapierSdk: vi.fn((options?: Record<string, unknown>) => ({ __options: options })),
  createExperimentalSdk: vi.fn((options?: Record<string, unknown>) => ({ __options: options })),
  identityLookups: 0,
}));

vi.mock("@zapier/zapier-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zapier/zapier-sdk")>();
  return { ...actual, createZapierSdk: h.createZapierSdk };
});
vi.mock("@zapier/zapier-sdk/experimental", () => ({
  createZapierSdk: h.createExperimentalSdk,
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ FOREMAN_MODE: "production" }),
}));
vi.mock("@/lib/crypto", () => ({
  decryptToken: (v: string) => `plain-${v}`,
  encryptToken: (v: string) => v,
}));
vi.mock("@/lib/identity", () => ({
  resolveActiveWorkspace: vi.fn(async () => null),
}));
vi.mock("@/lib/zapier/aliases", () => ({
  loadUserConnectionsMap: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => {
  // Minimal chainable supabase stub: every zapier_identity lookup resolves to
  // one non-expired row and is counted, so the test can see cache hits.
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    update: () => chain,
    maybeSingle: async () => {
      h.identityLookups++;
      return {
        data: {
          id: "zi-1",
          user_id: "user-1",
          access_token: "enc-token",
          refresh_token: "enc-refresh",
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
      };
    },
  };
  return { getSupabase: () => ({ from: () => chain }) };
});

import {
  checkKnownActionPermission,
  clearActionPermissions,
  recordActionPermissions,
} from "@/lib/guardrails";
import { actionRunResultJson, PROPOSAL_EXECUTION_TOOL, toolResultError } from "@/lib/proposals";
import { resolveTraceIds } from "@/lib/request-user-context";
import { getSdkForUser, withTraceOptions } from "@/lib/zapier/sdk";
import { createSummarizer, handleSdkError } from "@/lib/zapier-sdk-tools";

describe("request tracing — trace id resolution", () => {
  it("reads the thread id as correlationId and the proposal id as causationId", () => {
    const rc = new RequestContext([
      ["userId", "u"],
      ["threadId", "thread-1"],
      ["proposalId", "prop-1"],
    ]);
    expect(resolveTraceIds(rc)).toEqual({ correlationId: "thread-1", causationId: "prop-1" });
  });

  it("falls back to the tool's agent.threadId and omits unset ids", () => {
    expect(resolveTraceIds(new RequestContext(), "agent-thread")).toEqual({
      correlationId: "agent-thread",
    });
    expect(resolveTraceIds(undefined)).toEqual({});
  });

  it("layers trace ids onto SDK options without touching the rest", () => {
    const base = { credentials: "tok", debug: false };
    expect(withTraceOptions(base, { correlationId: "c" })).toEqual({
      credentials: "tok",
      debug: false,
      correlationId: "c",
    });
    expect(withTraceOptions(base, {})).toEqual(base);
  });
});

describe("request tracing — per-user client cache", () => {
  beforeEach(() => {
    h.createZapierSdk.mockClear();
    h.identityLookups = 0;
  });

  it("keeps auth cached per user and builds a lightweight traced client per call", async () => {
    const plain = (await getSdkForUser("cache-user")) as any;
    const lookupsAfterFirst = h.identityLookups;
    expect(plain.__options.credentials).toBe("plain-enc-token");
    expect(plain.__options.correlationId).toBeUndefined();

    const tracedA = (await getSdkForUser("cache-user", undefined, {
      correlationId: "thread-A",
    })) as any;
    const tracedB = (await getSdkForUser("cache-user", undefined, {
      correlationId: "thread-B",
      causationId: "prop-B",
    })) as any;

    // Trace ids aren't in the cache key: no further identity/token resolution.
    expect(h.identityLookups).toBe(lookupsAfterFirst);
    // Each traced client carries its own headers' source values + the cached auth.
    expect(tracedA.__options).toMatchObject({
      credentials: "plain-enc-token",
      correlationId: "thread-A",
    });
    expect(tracedA.__options.causationId).toBeUndefined();
    expect(tracedB.__options).toMatchObject({
      credentials: "plain-enc-token",
      correlationId: "thread-B",
      causationId: "prop-B",
    });
    // The untraced cached client is unchanged and still served.
    expect(await getSdkForUser("cache-user")).toBe(plain);
    expect(plain.__options.correlationId).toBeUndefined();
  });

  it("traces the very first (cache-miss) call too", async () => {
    const traced = (await getSdkForUser("fresh-user", undefined, {
      correlationId: "thread-X",
    })) as any;
    expect(traced.__options.correlationId).toBe("thread-X");
    // ...and the cached client it seeded is untraced.
    const plain = (await getSdkForUser("fresh-user")) as any;
    expect(plain.__options.correlationId).toBeUndefined();
  });
});

describe("handleSdkError — approval_token_invalid (SDK 0.115.0)", () => {
  it("is terminal and says a fresh approval is needed", () => {
    const res = handleSdkError(
      new ZapierApprovalError("token rejected", {
        status: "approval_token_invalid",
        approvalUrl: "https://zapier.com/approve/old",
      }),
      "run-action",
    );
    expect(res.code).toBe("APPROVAL_TOKEN_INVALID");
    expect(res.retryable).toBe(false);
    expect(res.error).toMatch(/fresh approval/i);
    // A stale approval link must not be offered again.
    expect(res.error).not.toContain("https://zapier.com/approve/old");
  });

  it("leaves other approval statuses on the existing path", () => {
    const res = handleSdkError(
      new ZapierApprovalError("pending", { status: "pending", approvalUrl: "https://x/y" }),
      "run-action",
    );
    expect(res.code).toBe("APPROVAL_REQUIRED");
  });
});

describe("result summarizer — is_managed / permissions / meta.id", () => {
  it("keeps is_managed on connection items, including false", () => {
    const out = createSummarizer("listConnections")({
      data: [
        {
          id: "1",
          title: "Team Slack",
          app_key: "slack",
          is_managed: true,
          a: 1,
          b: 2,
          c: 3,
          d: 4,
        },
        { id: "2", title: "Mine", app_key: "slack", is_managed: false },
      ],
    }) as any;
    expect(out.items[0].is_managed).toBe(true);
    expect(out.items[0]._extraFields).toBe(4);
    expect(out.items[1].is_managed).toBe(false);
  });

  it("keeps permissions on action and trigger items", () => {
    for (const fn of ["listActions", "listTriggers"]) {
      const out = createSummarizer(fn)({
        data: [
          {
            key: "send",
            title: "Send",
            app_key: "slack",
            action_type: "write",
            description: "d",
            is_hidden: false,
            is_important: true,
            app_version: "1",
            permissions: { can_use: false },
          },
        ],
      }) as any;
      expect(out.items[0].permissions).toEqual({ can_use: false });
    }
  });

  it("surfaces runAction meta.id as zapier_run_id — list and empty pages", () => {
    const list = createSummarizer("runAction")({
      data: [{ id: "row-1" }],
      meta: { id: "run-123" },
    }) as any;
    expect(list.zapier_run_id).toBe("run-123");

    const empty = createSummarizer("runAction")({ data: [], meta: { id: "run-456" } }) as any;
    expect(empty).toMatchObject({ items: [], count: 0, zapier_run_id: "run-456" });
  });

  it("surfaces meta.id on non-list runAction results and ignores it elsewhere", () => {
    const single = createSummarizer("runAction")({
      data: { ok: true },
      meta: { id: "run-789" },
    }) as any;
    expect(single.zapier_run_id).toBe("run-789");
    expect(single.data).toEqual({ ok: true });

    const other = createSummarizer("listApps")({ data: [], meta: { id: "x" } }) as any;
    expect(other.zapier_run_id).toBeUndefined();
  });
});

describe("proposal approve path helpers", () => {
  it("matches the real generated tool name", () => {
    expect(PROPOSAL_EXECUTION_TOOL).toBe("run-action");
  });

  it("stores zapier_run_id inside the action_run.result JSON", () => {
    expect(JSON.parse(actionRunResultJson({ items: [], zapier_run_id: "r1" })).zapier_run_id).toBe(
      "r1",
    );
    expect(JSON.parse(actionRunResultJson({ data: [], meta: { id: "r2" } })).zapier_run_id).toBe(
      "r2",
    );
    expect(JSON.parse(actionRunResultJson({ data: [] })).zapier_run_id).toBeUndefined();
  });

  it("recognises a structured tool failure", () => {
    expect(toolResultError({ error: "nope", code: "APP_BLOCKED", retryable: false })).toBe("nope");
    expect(toolResultError({ items: [] })).toBeNull();
  });
});

describe("admin-restricted action denial (permissions.can_use)", () => {
  beforeEach(() => clearActionPermissions());

  it("denies a run of an action discovery already saw as can_use=false", () => {
    recordActionPermissions("u1", "slack", [
      {
        key: "send",
        app_key: "SlackCLIAPI",
        action_type: "write",
        permissions: { can_use: false },
      },
    ]);
    const res = checkKnownActionPermission("u1", "slack", "write", "send");
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/restricted by an admin/i);
    // Also recorded under the item's own app_key.
    expect(checkKnownActionPermission("u1", "SlackCLIAPI", "write", "send").allowed).toBe(false);
  });

  it("allows unknown actions, can_use=true, and other users", () => {
    recordActionPermissions("u1", "slack", [
      { key: "send", app_key: "slack", action_type: "write", permissions: { can_use: false } },
      { key: "post", app_key: "slack", action_type: "write", permissions: { can_use: true } },
    ]);
    expect(checkKnownActionPermission("u1", "slack", "write", "post").allowed).toBe(true);
    expect(checkKnownActionPermission("u1", "slack", "write", "other").allowed).toBe(true);
    expect(checkKnownActionPermission("u2", "slack", "write", "send").allowed).toBe(true);
  });
});
