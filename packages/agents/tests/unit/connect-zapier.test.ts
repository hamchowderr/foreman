/**
 * Unit tests for the connect_zapier tool.
 *
 * Verifies the foreman-mcwn enhancement: when a connected user is in context,
 * the tool mints the SDK's signed, account-bound connection-start URL
 * (getConnectionStartUrl). It falls back to the generic engine deep-link when
 * there's no userId, the user isn't connected, or the SDK errors.
 */
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// App search runs on the default (account-agnostic) SDK.
const mockListApps = vi.fn();
vi.mock("@zapier/zapier-sdk", () => ({
  createZapierSdk: () => ({ listApps: mockListApps }),
}));

// Per-user SDK for the signed connect URL.
const mockGetConnectionStartUrl = vi.fn();
const mockGetSdkForUser = vi.fn();
vi.mock("@/lib/zapier/sdk", () => ({
  getSdkForUser: (...args: unknown[]) => mockGetSdkForUser(...args),
}));

import { connectZapierTool } from "@/mastra/tools/connect-zapier";

const GMAIL = {
  key: "gmail",
  slug: "gmail",
  title: "Gmail",
  implementation_id: "GoogleMailV2CLIAPI@2.8.3",
};

function ctx({ userId }: { userId?: string } = {}) {
  const entries: [string, string][] = [];
  if (userId) entries.push(["userId", userId]);
  return { requestContext: new RequestContext(entries) } as any;
}

const run = (input: { appSlug?: string }, c = ctx()) => connectZapierTool.execute!(input as any, c);

beforeEach(() => {
  vi.resetAllMocks();
  mockListApps.mockResolvedValue({ data: [GMAIL] });
  mockGetSdkForUser.mockResolvedValue({ getConnectionStartUrl: mockGetConnectionStartUrl });
});

describe("connect_zapier tool", () => {
  it("mints the signed, account-bound URL for a connected user", async () => {
    mockGetConnectionStartUrl.mockResolvedValue({
      data: { url: "https://zapier.com/sdk/connect?a=1&sig=abc", expiresAt: 123, app: "Gmail" },
    });

    const out: any = await run({ appSlug: "gmail" }, ctx({ userId: "u1" }));

    expect(mockGetSdkForUser).toHaveBeenCalledWith("u1");
    expect(mockGetConnectionStartUrl).toHaveBeenCalledWith({ app: "gmail" });
    expect(out.connectUrl).toBe("https://zapier.com/sdk/connect?a=1&sig=abc");
    expect(out.appName).toBe("Gmail");
    expect(out.expiresAt).toBe(123);
  });

  it("falls back to the engine deep-link when the user isn't connected", async () => {
    mockGetSdkForUser.mockRejectedValue(new Error("ZapierNotConnected"));

    const out: any = await run({ appSlug: "gmail" }, ctx({ userId: "u1" }));

    expect(out.connectUrl).toBe(`https://zapier.com/engine/auth/start/${GMAIL.implementation_id}/`);
    expect(mockGetConnectionStartUrl).not.toHaveBeenCalled();
  });

  it("falls back to the engine deep-link when there is no userId in context", async () => {
    const out: any = await run({ appSlug: "gmail" }, ctx());

    expect(mockGetSdkForUser).not.toHaveBeenCalled();
    expect(out.connectUrl).toBe(`https://zapier.com/engine/auth/start/${GMAIL.implementation_id}/`);
  });

  it("returns the generic connections page when no appSlug is given", async () => {
    const out: any = await run({});
    expect(out.connectUrl).toBe("https://zapier.com/app/connections");
  });

  it("returns the connections page when the app is not an exact match", async () => {
    mockListApps.mockResolvedValue({ data: [{ key: "notion", slug: "notion", title: "Notion" }] });

    const out: any = await run({ appSlug: "gmail" }, ctx({ userId: "u1" }));

    expect(out.connectUrl).toBe("https://zapier.com/app/connections");
  });
});
