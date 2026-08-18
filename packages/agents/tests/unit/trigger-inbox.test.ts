/**
 * Unit tests for the trigger-inbox layer (foreman-l7xq M1, rebuilt in foreman-em74).
 *
 * The layer is now thin on purpose: arm an inbox, read it, and hand consumption
 * to the SDK's own `watchTriggerInbox`. So these assert the delegation contract
 * rather than a loop we own — the options we pass decide whether a failed
 * message is redelivered or silently stranded until its lease expires.
 *
 * Dedup moved with the loop: it lives in `dispatchMessage` (a DB claim) and is
 * covered in automations-worker.test.ts.
 */
import { describe, expect, it, vi } from "vitest";
import { ensureInbox, type LeasedMessage, watchInbox } from "../../src/lib/trigger-inbox";
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
      key: "github-issues",
      app: "github",
      action: "issue_v2",
      connection: "123",
      inputs: { repo: "hamchowderr/foreman" },
    });
    expect(inbox.id).toBe("inbox_1");
    expect(sdk.ensureTriggerInbox).toHaveBeenCalledWith({
      key: "github-issues",
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
    await ensureInbox({ sdk, key: "n", app: "a", action: "b" });
    expect(
      (sdk.ensureTriggerInbox as ReturnType<typeof vi.fn>).mock.calls[0][0].connection,
    ).toBeNull();
  });
});

describe("watchInbox — delegation contract", () => {
  it("subscribes with release-on-error and continue-on-error, forwarding lease options", async () => {
    const sdk = fakeSdk({ watchTriggerInbox: vi.fn(async () => undefined) });
    const controller = new AbortController();

    await watchInbox({
      sdk,
      inbox: "inbox_1",
      onMessage: () => {},
      leaseLimit: 25,
      leaseSeconds: 60,
      signal: controller.signal,
    });

    const arg = (sdk.watchTriggerInbox as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.inbox).toBe("inbox_1");
    expect(arg.leaseLimit).toBe(25);
    expect(arg.leaseSeconds).toBe(60);
    expect(arg.signal).toBe(controller.signal);
    // Without releaseOnError a failed message stays leased until it times out
    // instead of being redelivered.
    expect(arg.releaseOnError).toBe(true);
    // Without continueOnError one poisoned message tears down the subscription.
    expect(arg.continueOnError).toBe(true);
  });

  it("hands our handler through as onMessage", async () => {
    const seen: string[] = [];
    const sdk = fakeSdk({
      watchTriggerInbox: vi.fn(async (opts: { onMessage: (m: LeasedMessage) => Promise<void> }) => {
        await opts.onMessage(msg("m1"));
      }),
    });

    await watchInbox({
      sdk,
      inbox: "inbox_1",
      onMessage: (m) => {
        seen.push(m.id);
      },
    });

    expect(seen).toEqual(["m1"]);
  });

  it("lets a handler rejection propagate so the SDK releases the message", async () => {
    const sdk = fakeSdk({
      watchTriggerInbox: vi.fn(async (opts: { onMessage: (m: LeasedMessage) => Promise<void> }) => {
        await opts.onMessage(msg("m2"));
      }),
    });

    await expect(
      watchInbox({
        sdk,
        inbox: "inbox_1",
        onMessage: () => {
          throw new Error("dispatch failed");
        },
      }),
    ).rejects.toThrow("dispatch failed");
  });
});
