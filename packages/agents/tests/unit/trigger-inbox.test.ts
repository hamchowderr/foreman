/**
 * Unit tests for the trigger-inbox layer (foreman-l7xq M1).
 * Drives the functions against a fake experimental SDK — no network. The dedup
 * test is the important one: at-least-once delivery means redeliveries, and
 * dispatchLeased must not re-run a message the caller already processed.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ackMessages,
  dispatchLeased,
  ensureInbox,
  type Lease,
  type LeasedMessage,
  releaseMessages,
} from "../../src/lib/trigger-inbox";
import type { ExperimentalZapierSdk } from "../../src/lib/zapier/sdk";

function fakeSdk(overrides: Record<string, unknown>): ExperimentalZapierSdk {
  return overrides as unknown as ExperimentalZapierSdk;
}

function msg(id: string, attrs: Partial<LeasedMessage["message_attributes"]> = {}): LeasedMessage {
  return {
    id,
    created_at: "2026-06-25T00:00:00Z",
    status: "leased",
    message_attributes: {
      lease_count: 1,
      error_message: null,
      possible_duplicate_data: false,
      ...attrs,
    },
    payload: { id },
  };
}

describe("ensureInbox", () => {
  it("passes the subscription through and returns the inbox record", async () => {
    const sdk = fakeSdk({
      ensureTriggerInbox: vi.fn(async () => ({
        data: { id: "inbox_1", name: "n", status: "initializing", subscription: {} },
      })),
    });
    const inbox = await ensureInbox({
      sdk,
      name: "github-issues",
      app: "github",
      action: "issue_v2",
      connection: "123",
      inputs: { repo: "hamchowderr/foreman" },
    });
    expect(inbox.id).toBe("inbox_1");
    expect(sdk.ensureTriggerInbox).toHaveBeenCalledWith({
      name: "github-issues",
      app: "github",
      action: "issue_v2",
      connection: "123",
      inputs: { repo: "hamchowderr/foreman" },
      notificationUrl: undefined,
    });
  });

  it("defaults a missing connection to null", async () => {
    const sdk = fakeSdk({
      ensureTriggerInbox: vi.fn(async () => ({ data: { id: "inbox_2" } })),
    });
    await ensureInbox({ sdk, name: "n", app: "a", action: "b" });
    expect(
      (sdk.ensureTriggerInbox as ReturnType<typeof vi.fn>).mock.calls[0][0].connection,
    ).toBeNull();
  });
});

describe("dispatchLeased — dedup", () => {
  function lease(results: LeasedMessage[]): Lease {
    return {
      lease_id: "lease_1",
      leased_until: "2026-06-25T00:05:00Z",
      results,
      inbox_attributes: { status: "active", paused_reason: null },
    };
  }

  it("processes fresh messages, skips already-seen redeliveries, releases failures", async () => {
    const seen = new Set(["m2"]);
    const handled: string[] = [];

    const result = await dispatchLeased({
      lease: lease([msg("m1"), msg("m2", { lease_count: 2 }), msg("m3")]),
      isAlreadyProcessed: (m) => seen.has(m.id),
      handle: (m) => {
        if (m.id === "m3") throw new Error("boom");
        handled.push(m.id);
      },
    });

    expect(result.processed).toEqual(["m1"]);
    expect(result.skipped).toEqual(["m2"]); // redelivery already in the idempotency store
    expect(result.failed).toEqual(["m3"]);
    expect(handled).toEqual(["m1"]); // m2 never re-ran
  });

  it("processes everything when no idempotency store is supplied", async () => {
    const result = await dispatchLeased({
      lease: lease([msg("a"), msg("b")]),
      handle: () => {},
    });
    expect(result.processed).toEqual(["a", "b"]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});

describe("ack / release", () => {
  it("acks processed messages by lease", async () => {
    const sdk = fakeSdk({
      ackTriggerInboxMessages: vi.fn(async () => ({ data: { acked_id: "x", results: [] } })),
    });
    await ackMessages({ sdk, inbox: "inbox_1", lease: "lease_1", messages: ["m1"] });
    expect(sdk.ackTriggerInboxMessages).toHaveBeenCalledWith({
      inbox: "inbox_1",
      lease: "lease_1",
      messages: ["m1"],
    });
  });

  it("releases failed messages for retry", async () => {
    const sdk = fakeSdk({
      releaseTriggerInboxMessages: vi.fn(async () => ({ data: { released_id: "x", results: [] } })),
    });
    await releaseMessages({ sdk, inbox: "inbox_1", lease: "lease_1", messages: ["m3"] });
    expect(sdk.releaseTriggerInboxMessages).toHaveBeenCalledWith({
      inbox: "inbox_1",
      lease: "lease_1",
      messages: ["m3"],
    });
  });
});
