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
    detail: null,
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
  listActiveScheduledAutomations: vi.fn(async () => []),
  getLastRunAt: vi.fn(async () => null),
  recordRun: vi.fn(async () => "run_sched"),
  listRecentRunsForWorkspace: vi.fn(async () => []),
  listPendingRuns: vi.fn(async () => []),
  getAutomationsByIds: vi.fn(async () => []),
}));

import * as store from "@/lib/automations/store";
import {
  dispatchMessage,
  reconcilePendingRuns,
  runDueSchedules,
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

  it("skips a possible-duplicate event without claiming when the flag is on (foreman-b8k2)", async () => {
    process.env.FOREMAN_SKIP_POSSIBLE_DUPLICATES = "true";
    try {
      const dup = msg("m1");
      dup.message_attributes.possible_duplicate_data = true;
      const out = await dispatchMessage({ sdk: {} as never, automation, message: dup });
      expect(out).toBe("skipped");
      expect(store.claimInboxMessage).not.toHaveBeenCalled();
      expect(triggerAutomation).not.toHaveBeenCalled();
    } finally {
      delete process.env.FOREMAN_SKIP_POSSIBLE_DUPLICATES;
    }
  });

  it("still fires a possible-duplicate event when the flag is off (default)", async () => {
    const dup = msg("m1");
    dup.message_attributes.possible_duplicate_data = true;
    vi.mocked(store.claimInboxMessage).mockResolvedValueOnce("run_dup");
    const out = await dispatchMessage({ sdk: {} as never, automation, message: dup });
    expect(out).toBe("processed");
    expect(triggerAutomation).toHaveBeenCalled();
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

  it("marks the automation trigger_failed when the inbox can't initialize (foreman-dwf8)", async () => {
    vi.mocked(ensureInbox).mockResolvedValueOnce({
      id: "inbox_1",
      status: "initialization_failure",
    } as never);
    vi.mocked(leaseMessages).mockResolvedValueOnce(leaseOf([], null) as never);
    // Inbox already armed + currently "active" — only the status should change.
    const armed = { ...(automation as object), trigger_inbox_id: "inbox_1", status: "active" };
    await runInboxCycleForAutomation({ sdk: {} as never, automation: armed as never });
    expect(store.updateAutomation).toHaveBeenCalledWith("ws-1", "auto_1", {
      status: "trigger_failed",
    });
  });

  it("clears trigger_failed back to active once the inbox recovers (foreman-dwf8)", async () => {
    vi.mocked(ensureInbox).mockResolvedValueOnce({ id: "inbox_1", status: "active" } as never);
    vi.mocked(leaseMessages).mockResolvedValueOnce(leaseOf([], null) as never);
    const failed = {
      ...(automation as object),
      trigger_inbox_id: "inbox_1",
      status: "trigger_failed",
    };
    await runInboxCycleForAutomation({ sdk: {} as never, automation: failed as never });
    expect(store.updateAutomation).toHaveBeenCalledWith("ws-1", "auto_1", { status: "active" });
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

describe("runDueSchedules (foreman-ufo3.1)", () => {
  beforeEach(() => vi.clearAllMocks());

  const NOW = Date.parse("2026-07-05T12:00:00Z");
  const scheduled = {
    id: "sched_1",
    user_id: "user-1",
    workspace_id: "ws-1",
    zapier_workflow_id: "wf_1",
    trigger: { schedule: { kind: "interval", everyMinutes: 15 } },
  };

  it("fires a due schedule and records the run as 'started'", async () => {
    vi.mocked(store.listActiveScheduledAutomations).mockResolvedValueOnce([scheduled] as never);
    vi.mocked(store.getLastRunAt).mockResolvedValueOnce(null); // never run → due

    const res = await runDueSchedules(NOW);

    expect(res).toEqual([{ automationId: "sched_1", fired: true, status: "started" }]);
    expect(triggerAutomation).toHaveBeenCalledWith(expect.objectContaining({ workflowId: "wf_1" }));
    expect(store.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: "sched_1", status: "started", triggerId: "trig_1" }),
    );
  });

  it("skips a not-due schedule without firing", async () => {
    vi.mocked(store.listActiveScheduledAutomations).mockResolvedValueOnce([scheduled] as never);
    vi.mocked(store.getLastRunAt).mockResolvedValueOnce(new Date(NOW - 5 * 60_000).toISOString());

    const res = await runDueSchedules(NOW);

    expect(res).toEqual([{ automationId: "sched_1", fired: false }]);
    expect(triggerAutomation).not.toHaveBeenCalled();
    expect(store.recordRun).not.toHaveBeenCalled();
  });

  it("synthesizes a digest instead of firing a durable (foreman-ufo3.2)", async () => {
    const digest = {
      ...scheduled,
      id: "digest_1",
      workspace_id: "ws-1",
      trigger: { schedule: { kind: "daily", atHourUtc: 9 }, digest: true },
    };
    vi.mocked(store.listActiveScheduledAutomations).mockResolvedValueOnce([digest] as never);
    vi.mocked(store.getLastRunAt).mockResolvedValueOnce(null); // due
    vi.mocked(store.listRecentRunsForWorkspace).mockResolvedValueOnce([
      {
        automation_id: "auto_x",
        status: "failed",
        error: { message: "boom" },
        created_at: "2026-07-05T10:00:00Z",
      },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_x", name: "Nightly sync" },
    ] as never);

    const res = await runDueSchedules(NOW);

    expect(res[0]).toMatchObject({ automationId: "digest_1", fired: true, status: "finished" });
    // Digest does NOT fire a Zapier durable — it records a finished run carrying the summary.
    expect(triggerAutomation).not.toHaveBeenCalled();
    expect(store.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "digest_1",
        status: "finished",
        output: expect.objectContaining({
          kind: "automation_digest",
          headline: expect.any(String),
        }),
      }),
    );
  });

  it("continues past a fire failure (one unconnected owner)", async () => {
    const a2 = { ...scheduled, id: "sched_2" };
    vi.mocked(store.listActiveScheduledAutomations).mockResolvedValueOnce([scheduled, a2] as never);
    vi.mocked(store.getLastRunAt).mockResolvedValue(null); // both due
    vi.mocked(triggerAutomation)
      .mockRejectedValueOnce(new Error("reauth required"))
      .mockResolvedValueOnce({ triggerId: "trig_2" } as never);

    const res = await runDueSchedules(NOW);

    expect(res[0]).toMatchObject({ automationId: "sched_1", fired: false });
    expect(res[1]).toMatchObject({ automationId: "sched_2", fired: true });
  });
});

describe("reconcilePendingRuns", () => {
  beforeEach(() => vi.clearAllMocks());

  const NOW = new Date().toISOString();
  const OLD = "2020-01-01T00:00:00.000Z"; // older than any STUCK_RUN_TIMEOUT_MS
  const pendingRun = {
    id: "run_1",
    automation_id: "auto_1",
    trigger_id: "trig_1",
    durable_run_id: null,
    status: "started",
    created_at: NOW,
  };
  const auto = [{ id: "auto_1", user_id: "user-1" }];

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

  it("flips a run to 'retrying' and surfaces the durable detail (foreman-jc12)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      { ...pendingRun, durable_run_id: "dr_9" },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    const detail = {
      totalAttempts: 2,
      lastError: { code: "X", title: "boom" },
      retrying: [{ name: "s", type: "run", status: "retrying", retryCount: 1 }],
    };
    vi.mocked(getDurableRunStatus).mockResolvedValueOnce({
      status: "started",
      output: null,
      error: null,
      detail,
    } as never);

    const res = await reconcilePendingRuns();
    // Non-terminal → not counted as "updated", but the row is rewritten.
    expect(res).toEqual({ checked: 1, updated: 0 });
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "retrying", error: detail }),
    );
  });

  it("flips a run to 'waiting' when the durable pauses on a callback (foreman-rm8z)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      { ...pendingRun, durable_run_id: "dr_9" },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    const detail = {
      retrying: [],
      waiting: true,
      callbacks: [{ name: "approve", status: "waiting", callbackToken: "cb_1" }],
    };
    vi.mocked(getDurableRunStatus).mockResolvedValueOnce({
      status: "started",
      output: null,
      error: null,
      detail,
    } as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 0 });
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "waiting", error: detail }),
    );
  });

  it("returns a recovered run to 'started' and clears the retry detail (foreman-jc12)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      {
        ...pendingRun,
        durable_run_id: "dr_9",
        status: "retrying",
        error: { totalAttempts: 1, retrying: [{ name: "s" }] },
      },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce([
      { id: "auto_1", user_id: "user-1" },
    ] as never);
    vi.mocked(getDurableRunStatus).mockResolvedValueOnce({
      status: "started",
      output: null,
      error: null,
      detail: null,
    } as never);

    await reconcilePendingRuns();
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "started", error: null }),
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

  it("fails a run whose durable never linked past the stuck timeout", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      { ...pendingRun, created_at: OLD },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce(auto as never);
    vi.mocked(getTriggerRunStatus).mockResolvedValueOnce({
      status: "started",
      durableRunId: null,
      output: null,
      error: null,
    } as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 1 });
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("fails an old claimed-but-never-dispatched run (no trigger_id)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      {
        id: "run_x",
        automation_id: "auto_1",
        trigger_id: null,
        durable_run_id: null,
        status: "initialized",
        created_at: OLD,
      },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce(auto as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 1 });
    expect(store.updateRun).toHaveBeenCalledWith(
      "run_x",
      expect.objectContaining({ status: "failed" }),
    );
    // never even resolved an SDK for an undispatched run
    expect(getTriggerRunStatus).not.toHaveBeenCalled();
  });

  it("does NOT fail a fresh unlinked run (within the timeout)", async () => {
    vi.mocked(store.listPendingRuns).mockResolvedValueOnce([
      { ...pendingRun, created_at: NOW },
    ] as never);
    vi.mocked(store.getAutomationsByIds).mockResolvedValueOnce(auto as never);
    vi.mocked(getTriggerRunStatus).mockResolvedValueOnce({
      status: "started",
      durableRunId: null,
      output: null,
      error: null,
    } as never);

    const res = await reconcilePendingRuns();
    expect(res).toEqual({ checked: 1, updated: 0 });
    expect(store.updateRun).not.toHaveBeenCalled();
  });
});
