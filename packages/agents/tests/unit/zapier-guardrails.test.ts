/**
 * Guardrail enforcement on the generated Zapier tools (foreman-nz8b).
 *
 * These exist because the guardrail engine shipped with ZERO enforcement: its
 * only caller was a wrapper that had been dead for months, so rate limiting and
 * sensitive-app blocking never ran on a single agent action while the landing
 * page advertised both. The whole suite stayed green throughout — nothing was
 * asserting that a blocked action is actually blocked. Now something does.
 *
 * Only the DENIAL paths are driven end-to-end: they return before the SDK is
 * touched, so no network and no credentials are involved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/guardrails", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  checkAppAccess: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/request-user-context", () => ({
  requestUserContext: { getStore: vi.fn(() => ({ userId: "user-1" })) },
}));

import { checkAppAccess, checkRateLimit } from "@/lib/guardrails";

import { requestUserContext } from "@/lib/request-user-context";
import { generateZapierTools } from "@/lib/zapier-sdk-tools";

const tools = generateZapierTools();

/** Drive a generated tool's execute with the given input. */
async function run(toolId: string, input: Record<string, unknown> = {}) {
  const tool = tools[toolId] as unknown as { execute: (i: unknown) => Promise<any> };
  expect(tool, `${toolId} should be a generated tool`).toBeTruthy();
  return tool.execute(input);
}

describe("guardrails on generated tools", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(checkAppAccess).mockResolvedValue({ allowed: true });
    vi.mocked(requestUserContext.getStore).mockReturnValue({ userId: "user-1" } as never);
    vi.clearAllMocks();
  });

  it("blocks a write tool when the user is over their rate limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 42_000 });

    const res = await run("run-action", { app: "slack", actionType: "write", action: "send" });

    expect(res.code).toBe("RATE_LIMITED");
    expect(res.retryable).toBe(true);
    expect(res.error).toContain("42s");
    // Never reached the SDK — a throttled call must cost nothing.
    expect(checkAppAccess).not.toHaveBeenCalled();
  });

  it("blocks a write tool naming a sensitive app", async () => {
    vi.mocked(checkAppAccess).mockResolvedValue({
      allowed: false,
      reason: "Access to banking apps (chase) is blocked.",
    });

    const res = await run("run-action", { app: "chase", actionType: "write", action: "transfer" });

    expect(res.code).toBe("APP_BLOCKED");
    expect(res.retryable).toBe(false);
    expect(res.error).toContain("chase");
    expect(checkAppAccess).toHaveBeenCalledWith("user-1", "chase");
  });

  it("does not rate-limit read-only discovery tools", async () => {
    // Deny everything: a read-only tool must still not return the denial, or the
    // agent's own search loop would starve long before a user did anything.
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });

    const res = await run("list-apps", {});

    expect(res?.code).not.toBe("RATE_LIMITED");
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("skips guardrails entirely when there is no user context", async () => {
    // Channel webhook processing runs on the shared client; both checks are
    // per-user and have nobody to charge.
    vi.mocked(requestUserContext.getStore).mockReturnValue(undefined as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });

    // Past the gate this reaches the real SDK, so don't wait for it — the claim
    // under test is only that the gate did not run. Race a short timer and
    // swallow whatever the call eventually does.
    const call = run("run-action", { app: "slack", actionType: "write", action: "send" }).catch(
      () => "sdk-error",
    );
    const res = await Promise.race([
      call,
      new Promise((resolve) => setTimeout(() => resolve("still-running"), 300)),
    ]);

    expect(res).not.toMatchObject({ code: "RATE_LIMITED" });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});
