/**
 * Unit tests for the Zapier SDK deprecation-notice relay (SDK >= 0.79).
 * Verifies the onEvent handler logs deprecation notices once per id, ignores
 * non-deprecation events, and records them for later surfacing.
 */
import { DEPRECATION_NOTICE_EVENT } from "@zapier/zapier-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetZapierDeprecations,
  getZapierDeprecations,
  onZapierSdkEvent,
} from "@/lib/zapier/deprecation";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetZapierDeprecations();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe("onZapierSdkEvent — deprecation relay", () => {
  it("logs and records a deprecation notice", () => {
    onZapierSdkEvent({
      type: DEPRECATION_NOTICE_EVENT,
      payload: { id: "n1", message: "runDurable is deprecated" },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[zapier:deprecation]");
    expect(warnSpy.mock.calls[0][0]).toContain("runDurable is deprecated");
    expect(getZapierDeprecations()).toHaveLength(1);
  });

  it("logs each notice id at most once per process", () => {
    const ev = { type: DEPRECATION_NOTICE_EVENT, payload: { id: "n1", message: "x" } };
    onZapierSdkEvent(ev);
    onZapierSdkEvent(ev);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(getZapierDeprecations()).toHaveLength(1);
  });

  it("includes the RFC-9745 deprecation date when present", () => {
    onZapierSdkEvent({
      type: DEPRECATION_NOTICE_EVENT,
      payload: { id: "n2", message: "going away", deprecation: 1782400000000 },
    });
    expect(warnSpy.mock.calls[0][0]).toContain("deprecated 2026-");
  });

  it("ignores non-deprecation events and payloads without an id", () => {
    onZapierSdkEvent({ type: "api_request", payload: { url: "/x" } });
    onZapierSdkEvent({ type: DEPRECATION_NOTICE_EVENT, payload: { message: "no id" } as any });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(getZapierDeprecations()).toHaveLength(0);
  });
});
