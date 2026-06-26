/**
 * Unit tests for the trigger-inbox worker (foreman-l7xq M3). Mocks the store, the
 * trigger-inbox layer, and the durable layer. The dedup assertion is the point: a
 * redelivered (already-claimed) message must not re-fire the durable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/zapier/sdk", () => ({ getExperimentalSdkForUser: vi.fn(async () => ({})) }));
vi.mock("@/lib/durable", () => ({
  triggerAutomation: vi.fn(async () => ({ triggerId: "trig_1" })),
  getTriggerRunStatus: vi.fn(async () => ({
    status: "started",
    durableRunId: "dr_1",
    output: null,
    error: null,
  })),
  getDurableRunStatus: vi.fn(async () => ({
    status: "finished",
    output: { ok: true },
    error: null,
  })),
}));
vi.mock("@/lib/trigger-inbox", () => ({
  ensureInbox: vi.fn(async () => ({ id: "inbox_1", status: "active" })),
  leaseMessages: vi.fn(),
  ackMessages: vi.fn(async () => ({})),
  releaseMessages: vi.fn(async () => ({})),
}));
vi.mock("@/lib/automations/store", () => ({
  claimInboxMessage: vi.fn(),
  updateRun: vi.fn(async () => {}),
  updateAutomation: vi.fn(async () => true),
  listActiveInboxAutomations: vi.fn(async () => []),
  listPendingRuns: vi.fn(async () => []),
  getAutomationsByIds: vi.fn(async () => []),
}));

import * as store from "@/lib/automations/store";
import {
  dispatchMessage,
  reconcilePendingRuns,
  runInboxCycleForAutomation,
} from "@/lib/automations/worker";
import { getDurableRunStatus, getTriggerRunStatus, triggerAutomation } from "@/lib/durable";
import { ackMessages, ensureInbox, leaseMessages, releaseMessages } from "@/lib/trigger-inbox";

const automation = {
  id: "auto_1",
  user_id: "user-1",
  workspace_id: "ws-1",
  zapier_workflow_id: "wf_1",
  trigger: { app: "github", action: "new_issue" },
  trigger_inbox_id: null,
  enabled: true,
} as never;

function msg(id: string) {
  return {
    id,
    created_at: "t",
    status: "leased",
    message_attributes: { lease_count: 1, error_message: null, possible_duplicate_data: false },
    payload: { id },
  };
}

function leaseOf(results: ReturnType<typeof msg>[], leaseId: string | null = "lease_1") {
  return {
    lease_id: leaseId,
    leased_until: "t",
    results,
    inbox_attributes: { status: "active", paused_reason: null },
  };
}

describe("dispatchMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips an already-claimed (redelivered) message without firing", async () => {
    vi.mocked(store.claimInboxMessage).mockResolvedValueOnce(null);
    const out = await dispatchMessage({ sdk: {} as never, automation, message: msg("m1") });
    expect(out).toBe("skipped");
    expect(triggerAutomation).not.toHaveBeenCalled();
  });

  it("fires + records the run as 'started' (no blocking poll — reconcile finishes it)", async () => {
    vi.mocked(store.claimInboxMessage).mockResolvedValueOnce("run_1");
    const out = await dispatchMessage({ sdk: {} as never, automation, message: msg("m1") });
    expect(out).toBe("processed");
    expect(triggerAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "wf_1", input: { id: "m1" } }),
    );
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "started", triggerId: "trig_1" }),
    );
    // It must NOT block on the trigger/durable status at dispatch time.
    expect(getTriggerRunStatus).not.toHaveBeenCalled();
  });

  it("marks failed + records the error when the trigger throws", async () => {
    vi.mocked(store.claimInboxMessage).mockResolvedValueOnce("run_2");
    vi.mocked(triggerAutomation).mockRejectedValueOnce(new Error("boom"));
    const out = await dispatchMessage({ sdk: {} as never, automation, message: msg("m1") });
    expect(out).toBe("failed");
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_2",
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("runInboxCycleForAutomation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ensures the inbox, dispatches the batch, acks done + releases failed", async () => {
    vi.mocked(leaseMessages).mockResolvedValueOnce(
      leaseOf([msg("m1"), msg("m2"), msg("m3")]) as never,
    );
    // m1 fresh → processed, m2 redelivery → skipped, m3 fresh but trigger throws → failed
    vi.mocked(store.claimInboxMessage)
      .mockResolvedValueOnce("run_m1")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("run_m3");
    vi.mocked(triggerAutomation)
      .mockResolvedValueOnce({ triggerId: "t1" } as never)
      .mockRejectedValueOnce(new Error("x"));

    const res = await runInboxCycleForAutomation({ sdk: {} as never, automation });

    expect(ensureInbox).toHaveBeenCalled();
    expect(res).toMatchObject({ inboxId: "inbox_1", processed: 1, skipped: 1, failed: 1 });
    expect(ackMessages).toHaveBeenCalledWith(expect.objectContaining({ messages: ["m1", "m2"] }));
    expect(releaseMessages).toHaveBeenCalledWith(expect.objectContaining({ messages: ["m3"] }));
    // persisted the inbox id (it was null before)
    expect(store.updateAutomation).toHaveBeenCalledWith("ws-1", "auto_1", {
      triggerInboxId: "inbox_1",
    });
  });

  it("returns zeros and skips ensureInbox when not inbox-triggered", async () => {
    const noTrigger = { ...(automation as object), trigger: null } as never;
    const res = await runInboxCycleForAutomation({ sdk: {} as never, automation: noTrigger });
    expect(res).toMatchObject({ processed: 0, skipped: 0, failed: 0, inboxId: null });
    expect(ensureInbox).not.toHaveBeenCalled();
  });

  it("no-ops on an empty lease (no ack/release)", async () => {
    vi.mocked(leaseMessages).mockResolvedValueOnce(leaseOf([], null) as never);
    const res = await runInboxCycleForAutomation({ sdk: {} as never, automation });
    expect(res.processed).toBe(0);
    expect(ackMessages).not.toHaveBeenCalled();
    expect(releaseMessages).not.toHaveBeenCalled();
  });
});

describe("reconcilePendingRuns", () => {
  beforeEach(() => vi.clearAllMocks());

  const pendingRun = {
    id: "run_1",
    automation_id: "auto_1",
    trigger_id: "trig_1",
    durable_run_id: null,
    status: "started",
  };

  it("resolves trigger→durable and writes the terminal status", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([pendingRun] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    // durable not linked yet → getTriggerRun resolves it; getDurableRun → finished
    vi.mocked(getTriggerRunStatus).mockResolvedValueOnce({
      status: "started",
      durableRunId: "dr_9",
      output: null,
      error: null,
    } as never);

    const res = await reconcilePendingRuns();

    expect(res).toEqual({ checked: 1, updated: 1 });
    expect(getDurableRunStatus).toHaveBeenCalledWith(expect.anything(), "dr_9");
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "finished", durableRunId: "dr_9" }),
    );
  });

  it("leaves a still-running durable as 'started' (no terminal write)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      { ...pendingRun, durable_run_id: "dr_9" },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    vi.mocked(getDurableRunStatus).mockResolvedValueOnce({
      status: "started",
      output: null,
      error: null,
    } as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 0 });
    // already 'started' with the same durable id → nothing to write
    expect(store.updateRun).not.toHaveBeenCalled();
    // and it must NOT need getTriggerRun once the durable id is known
    expect(getTriggerRunStatus).not.toHaveBeenCalled();
  });

  it("skips a run whose durable isn't linked yet", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([pendingRun] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    vi.mocked(getTriggerRunStatus).mockResolvedValueOnce({
      status: "started",
      durableRunId: null,
      output: null,
      error: null,
    } as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 0 });
    expect(getDurableRunStatus).not.toHaveBeenCalled();
    expect(store.updateRun).not.toHaveBeenCalled();
  });
});
