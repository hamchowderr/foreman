/**
 * Acting-user resolution (foreman-3i9k, Phase 0b).
 *
 * This is the seam the native-channels migration turns on. Today every channel
 * bot wraps its agent call in an AsyncLocalStorage scope, and Zapier tools read
 * that scope to pick whose OAuth connection to use. Native Mastra channels
 * invoke the agent from Mastra's OWN route, so that scope does not exist there
 * — an ALS-only read would fall back to the global client-credentials SDK and
 * act as the WRONG Zapier identity, silently and with no error to notice.
 *
 * These pin the precedence that makes both work at once.
 */
import { RequestContext } from "@mastra/core/request-context";
import { describe, expect, it } from "vitest";
import { requestUserContext, resolveRequestUserId } from "@/lib/request-user-context";

describe("resolveRequestUserId", () => {
  it("reads the acting user from the run's RequestContext", () => {
    // The native-channels path: a handler stamps ctx.requestContext before
    // calling defaultHandler, and no ALS scope is involved at all.
    const rc = new RequestContext([["userId", "user-from-request"]]);
    expect(resolveRequestUserId(rc)).toBe("user-from-request");
  });

  it("falls back to the AsyncLocalStorage the custom bots still set", () => {
    requestUserContext.run({ userId: "user-from-als" }, () => {
      expect(resolveRequestUserId(undefined)).toBe("user-from-als");
      expect(resolveRequestUserId(new RequestContext())).toBe("user-from-als");
    });
  });

  it("prefers the RequestContext when both are present", () => {
    // The web /chat route sets both and they agree, so this is not about
    // resolving a live conflict — it is about the ambient value never winning.
    // An ALS scope can outlive its run() across an await boundary; an explicitly
    // passed context cannot.
    requestUserContext.run({ userId: "user-from-als" }, () => {
      const rc = new RequestContext([["userId", "user-from-request"]]);
      expect(resolveRequestUserId(rc)).toBe("user-from-request");
    });
  });

  it("returns undefined when neither source has a user", () => {
    expect(resolveRequestUserId(undefined)).toBeUndefined();
    expect(resolveRequestUserId(new RequestContext())).toBeUndefined();
  });

  it("ignores a non-string or empty userId rather than acting as it", () => {
    // A blank id would sail through a truthiness check and then be handed to
    // getSdkForUser as a real user. Treat it as absent.
    expect(resolveRequestUserId(new RequestContext([["userId", ""]]))).toBeUndefined();
    expect(
      resolveRequestUserId(new RequestContext([["userId", { id: "nope" } as never]])),
    ).toBeUndefined();
  });

  it("does not leak a user id outside the ALS scope that set it", () => {
    requestUserContext.run({ userId: "scoped" }, () => {
      expect(resolveRequestUserId()).toBe("scoped");
    });
    expect(resolveRequestUserId()).toBeUndefined();
  });
});
