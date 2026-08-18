/**
 * Guardrail enforcement on the generated Zapier tools (foreman-nz8b), and the
 * acting-user resolution those guardrails key on (foreman-3i9k).
 *
 * These exist because the guardrail engine shipped with ZERO enforcement: its
 * only caller was a wrapper that had been dead for months, so rate limiting and
 * sensitive-app blocking never ran on a single agent action while the landing
 * page advertised both. The whole suite stayed green throughout — nothing was
 * asserting that a blocked action is actually blocked. Now something does.
 *
 * `@/lib/request-user-context` is deliberately NOT mocked: the claim under test
 * is that a real `RequestContext` reaches a real tool's execute and decides who
 * the call runs as. Mocking the resolver would assert only that the mock was
 * called.
 *
 * Only the DENIAL paths are driven end-to-end: they return before the SDK is
 * touched, so no network and no credentials are involved.
 */
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/guardrails", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  checkAppAccess: vi.fn(async () => ({ allowed: true })),
}));

import { checkAppAccess, checkRateLimit } from "@/lib/guardrails";
import { requestUserContext } from "@/lib/request-user-context";
import { generateZapierTools } from "@/lib/zapier-sdk-tools";

const tools = generateZapierTools();

/** Drive a generated tool's execute with the given input and run context. */
async function run(
  toolId: string,
  input: Record<string, unknown> = {},
  requestContext?: RequestContext,
) {
  const tool = tools[toolId] as unknown as {
    execute: (i: unknown, c?: { requestContext?: RequestContext }) => Promise<any>;
  };
  expect(tool, `${toolId} should be a generated tool`).toBeTruthy();
  return tool.execute(input, requestContext ? { requestContext } : undefined);
}

/** The ALS scope the custom channel bots still establish today. */
function asAlsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestUserContext.run({ userId }, fn);
}

const WRITE = { app: "slack", actionType: "write", action: "send" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
  vi.mocked(checkAppAccess).mockResolvedValue({ allowed: true });
});

describe("guardrails on generated tools", () => {
  it("blocks a write tool when the user is over their rate limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 42_000 });

    const res = await asAlsUser("user-1", () => run("run-action", WRITE));

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

    const res = await asAlsUser("user-1", () =>
      run("run-action", { app: "chase", actionType: "write", action: "transfer" }),
    );

    expect(res.code).toBe("APP_BLOCKED");
    expect(res.retryable).toBe(false);
    expect(res.error).toContain("chase");
    expect(checkAppAccess).toHaveBeenCalledWith("user-1", "chase");
  });

  it("does not rate-limit read-only discovery tools", async () => {
    // Deny everything: a read-only tool must still not return the denial, or the
    // agent's own search loop would starve long before a user did anything.
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });

    const res = await asAlsUser("user-1", () => run("list-apps", {}));

    expect(res?.code).not.toBe("RATE_LIMITED");
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("skips guardrails entirely when there is no user context", async () => {
    // Unauthenticated webhook processing runs on the shared client; both checks
    // are per-user and have nobody to charge.
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });

    // Past the gate this reaches the real SDK, so don't wait for it — the claim
    // under test is only that the gate did not run. Race a short timer and
    // swallow whatever the call eventually does.
    const call = run("run-action", WRITE).catch(() => "sdk-error");
    const res = await Promise.race([
      call,
      new Promise((resolve) => setTimeout(() => resolve("still-running"), 300)),
    ]);

    expect(res).not.toMatchObject({ code: "RATE_LIMITED" });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});

describe("acting user reaching tool execution (foreman-3i9k)", () => {
  it("charges the RequestContext user with no ALS scope anywhere", async () => {
    // This is the native-channels shape: Mastra's own route invokes the agent,
    // so there is no AsyncLocalStorage. Before this wiring the tool saw no user
    // at all and ran as the global client-credentials identity — the exact
    // silent wrong-identity failure the migration has to avoid.
    vi.mocked(checkAppAccess).mockResolvedValue({ allowed: false, reason: "blocked" });

    const res = await run(
      "run-action",
      { app: "chase", actionType: "write", action: "transfer" },
      new RequestContext([["userId", "channel-user"]]),
    );

    expect(res.code).toBe("APP_BLOCKED");
    expect(checkAppAccess).toHaveBeenCalledWith("channel-user", "chase");
  });

  it("lets the RequestContext user win over an ALS scope", async () => {
    vi.mocked(checkAppAccess).mockResolvedValue({ allowed: false, reason: "blocked" });

    const res = await asAlsUser("als-user", () =>
      run(
        "run-action",
        { app: "chase", actionType: "write", action: "transfer" },
        new RequestContext([["userId", "request-user"]]),
      ),
    );

    expect(res.code).toBe("APP_BLOCKED");
    expect(checkAppAccess).toHaveBeenCalledWith("request-user", "chase");
    expect(checkAppAccess).not.toHaveBeenCalledWith("als-user", "chase");
  });

  it("still honours the ALS the custom bots set today", async () => {
    // The nine existing bots are untouched by this change and must keep working
    // until each one is migrated.
    vi.mocked(checkAppAccess).mockResolvedValue({ allowed: false, reason: "blocked" });

    const res = await asAlsUser("als-user", () =>
      run("run-action", { app: "chase", actionType: "write", action: "transfer" }),
    );

    expect(res.code).toBe("APP_BLOCKED");
    expect(checkAppAccess).toHaveBeenCalledWith("als-user", "chase");
  });
});
