import { describe, expect, it } from "vitest";
import {
  ZapierActionFailed,
  ZapierCapabilityDenied,
  ZapierError,
  ZapierNotConnected,
  ZapierRateLimited,
  ZapierReauthRequired,
} from "@/lib/zapier/errors";

describe("Zapier errors", () => {
  it("ZapierError has correct properties", () => {
    const err = new ZapierError("test", "TEST_CODE", { foo: "bar" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ZapierError");
    expect(err.code).toBe("TEST_CODE");
    expect(err.context).toEqual({ foo: "bar" });
    expect(err.message).toBe("test");
  });

  it("ZapierNotConnected includes userId", () => {
    const err = new ZapierNotConnected("user-123");
    expect(err).toBeInstanceOf(ZapierError);
    expect(err.name).toBe("ZapierNotConnected");
    expect(err.code).toBe("ZAPIER_NOT_CONNECTED");
    expect(err.context?.userId).toBe("user-123");
  });

  it("ZapierReauthRequired includes userId and reason", () => {
    const err = new ZapierReauthRequired("user-456", "expired");
    expect(err).toBeInstanceOf(ZapierError);
    expect(err.name).toBe("ZapierReauthRequired");
    expect(err.code).toBe("ZAPIER_REAUTH_REQUIRED");
    expect(err.context?.userId).toBe("user-456");
    expect(err.context?.reason).toBe("expired");
  });

  it("ZapierRateLimited includes retryAfter", () => {
    const err = new ZapierRateLimited(30);
    expect(err).toBeInstanceOf(ZapierError);
    expect(err.name).toBe("ZapierRateLimited");
    expect(err.code).toBe("ZAPIER_RATE_LIMITED");
    expect(err.context?.retryAfter).toBe(30);
  });

  it("ZapierActionFailed includes actionKey and detail", () => {
    const err = new ZapierActionFailed("gmail_send", "auth error");
    expect(err).toBeInstanceOf(ZapierError);
    expect(err.name).toBe("ZapierActionFailed");
    expect(err.code).toBe("ZAPIER_ACTION_FAILED");
    expect(err.context?.actionKey).toBe("gmail_send");
    expect(err.context?.detail).toBe("auth error");
  });

  it("ZapierCapabilityDenied includes capability and userId", () => {
    const err = new ZapierCapabilityDenied("execute_action", "user-789");
    expect(err).toBeInstanceOf(ZapierError);
    expect(err.name).toBe("ZapierCapabilityDenied");
    expect(err.code).toBe("ZAPIER_CAPABILITY_DENIED");
    expect(err.context?.capability).toBe("execute_action");
    expect(err.context?.userId).toBe("user-789");
  });
});
