/**
 * Workspace guardrail configuration (foreman-nz8b).
 *
 * The previous version of this file asserted the stub: it checked that
 * `getOrgGuardrailConfig("org-123")` still returned 30/min — i.e. it pinned the
 * bug in place, since the whole problem was that the orgId was ignored and
 * nothing was ever stored. These assert the real behaviour instead: settings
 * come from the workspace, NULL columns inherit the defaults, and a failed read
 * falls back to the defaults rather than leaving the limiter unset.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
vi.mock("@/lib/db", () => ({
  getSupabase: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/identity", () => ({ resolveActiveWorkspace: vi.fn() }));

import {
  GUARDRAIL_DEFAULTS,
  getWorkspaceGuardrailConfig,
  guardrailConfigForUser,
  invalidateGuardrailConfig,
} from "@/lib/guardrails-config";
import { resolveActiveWorkspace } from "@/lib/identity";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateGuardrailConfig(); // the cache is module-level — reset between tests
  maybeSingle.mockResolvedValue({ data: null });
});

describe("getWorkspaceGuardrailConfig", () => {
  it("returns the built-in defaults when there is no workspace", async () => {
    expect(await getWorkspaceGuardrailConfig(null)).toEqual(GUARDRAIL_DEFAULTS);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("returns the workspace's configured values", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        rate_limit_per_minute: 5,
        rate_limit_per_hour: 50,
        max_bulk_items: 2,
        redact_emails: true,
      },
    });

    const config = await getWorkspaceGuardrailConfig("ws-1");

    expect(config).toEqual({
      rateLimitPerMinute: 5,
      rateLimitPerHour: 50,
      maxBulkItems: 2,
      redactEmails: true,
    });
  });

  it("treats a NULL column as inherit-the-default, not as no-limit", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        rate_limit_per_minute: null,
        rate_limit_per_hour: 50,
        max_bulk_items: null,
        redact_emails: false,
      },
    });

    const config = await getWorkspaceGuardrailConfig("ws-2");

    expect(config.rateLimitPerMinute).toBe(GUARDRAIL_DEFAULTS.rateLimitPerMinute);
    expect(config.maxBulkItems).toBe(GUARDRAIL_DEFAULTS.maxBulkItems);
    expect(config.rateLimitPerHour).toBe(50);
  });

  it("falls back to defaults when the settings read fails", async () => {
    maybeSingle.mockRejectedValue(new Error("db down"));
    // Defaults are stricter than no guardrail, so a failed read must not open
    // the gate.
    expect(await getWorkspaceGuardrailConfig("ws-3")).toEqual(GUARDRAIL_DEFAULTS);
  });

  it("caches per workspace, and invalidation forces a re-read", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        rate_limit_per_minute: 7,
        rate_limit_per_hour: 70,
        max_bulk_items: 1,
        redact_emails: false,
      },
    });

    await getWorkspaceGuardrailConfig("ws-4");
    await getWorkspaceGuardrailConfig("ws-4");
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    invalidateGuardrailConfig("ws-4");
    await getWorkspaceGuardrailConfig("ws-4");
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});

describe("guardrailConfigForUser", () => {
  it("resolves the user's workspace and applies its settings", async () => {
    vi.mocked(resolveActiveWorkspace).mockResolvedValue("ws-9");
    maybeSingle.mockResolvedValue({
      data: {
        rate_limit_per_minute: 3,
        rate_limit_per_hour: 30,
        max_bulk_items: 5,
        redact_emails: true,
      },
    });

    const config = await guardrailConfigForUser("user-1");

    expect(resolveActiveWorkspace).toHaveBeenCalledWith("user-1");
    expect(config.rateLimitPerMinute).toBe(3);
    expect(config.redactEmails).toBe(true);
  });

  it("falls back to defaults for a user with no workspace", async () => {
    vi.mocked(resolveActiveWorkspace).mockResolvedValue(null);
    expect(await guardrailConfigForUser("user-2")).toEqual(GUARDRAIL_DEFAULTS);
  });
});
