/**
 * Unit tests for the automation service (foreman-l7xq M2) — the deploy+persist
 * orchestration shared by the agent tools and the web routes. Mocks the durable
 * layer, the store, identity, and the SDK resolver.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/identity", () => ({ resolveActiveWorkspace: vi.fn(async () => "ws-1") }));
vi.mock("@/lib/zapier/sdk", () => ({
  getExperimentalSdkForUser: vi.fn(async (userId: string) => ({ __owner: userId })),
}));
vi.mock("@/lib/trigger-inbox", () => ({ getInbox: vi.fn(), listInboxMessages: vi.fn() }));
vi.mock("@/lib/automations/schedules", () => ({
  registerAutomationSchedule: vi.fn(async () => true),
  unregisterAutomationSchedule: vi.fn(async () => {}),
  assertValidCron: vi.fn(),
}));
vi.mock("@/lib/durable", () => ({
  deployAutomation: vi.fn(async () => ({
    workflowId: "wf_1",
    versionId: "ver_1",
    enabled: true,
    isPrivate: true,
    editorUrl: "https://zapier.com/durables-editor/wf_1",
    triggerUrl: "https://trig/x",
    triggerClaimFailed: false,
    disabledReason: null,
  })),
  triggerAutomation: vi.fn(async () => ({ triggerId: "trig_1" })),
  getTriggerRunStatus: vi.fn(async () => ({
    status: "finished",
    durableRunId: "dr_1",
    output: null,
    error: null,
  })),
  setAutomationEnabled: vi.fn(async () => false),
  deleteAutomation: vi.fn(async () => {}),
  cancelDurableRun: vi.fn(async () => "cancelled"),
  resolveCallbackUrl: vi.fn(),
  postCallback: vi.fn(async () => ({ ok: true, status: 200 })),
}));
vi.mock("@/lib/automations/store", () => ({
  createAutomation: vi.fn(async () => "auto_1"),
  getAutomation: vi.fn(),
  listAutomations: vi.fn(async () => [{ id: "auto_1" }]),
  listRuns: vi.fn(async () => []),
  getLatestDigest: vi.fn(async () => null),
  getRun: vi.fn(),
  recordRun: vi.fn(async () => "run_1"),
  updateRun: vi.fn(async () => {}),
  deleteAutomation: vi.fn(),
  updateAutomation: vi.fn(async () => true),
}));

import { registerAutomationSchedule } from "@/lib/automations/schedules";
import {
  cancelRunForUser,
  getWorkspaceInbox,
  provisionAutomation,
  removeAutomationForUser,
  respondToCallbackForUser,
  runAutomationById,
} from "@/lib/automations/service";
import * as store from "@/lib/automations/store";
import {
  cancelDurableRun,
  deleteAutomation as deleteZapierWorkflow,
  deployAutomation,
  postCallback,
  resolveCallbackUrl,
} from "@/lib/durable";
import { getInbox, listInboxMessages } from "@/lib/trigger-inbox";
import { getExperimentalSdkForUser } from "@/lib/zapier/sdk";

describe("provisionAutomation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deploys then persists, mapping a clean deploy to status=active", async () => {
    const result = await provisionAutomation({
      userId: "user-1",
      name: "Notify",
      source: "SRC",
      connections: { slack: "123" },
    });

    expect(result.id).toBe("auto_1");
    expect(result.workflowId).toBe("wf_1");

    const persisted = vi.mocked(store.createAutomation).mock.calls[0][0];
    expect(persisted).toMatchObject({
      userId: "user-1",
      workspaceId: "ws-1",
      zapierWorkflowId: "wf_1",
      zapierVersionId: "ver_1",
      status: "active",
      enabled: true,
    });
  });

  it("stores an inbox trigger spec (deployed as a manual durable — the worker arms it)", async () => {
    await provisionAutomation({
      userId: "user-1",
      name: "On new issue",
      source: "SRC",
      trigger: { app: "github", action: "new_issue", inputs: { repo: "owner/name" } },
    });

    // The durable is deployed WITHOUT a Zapier-claimed trigger.
    const deployArg = vi.mocked(deployAutomation).mock.calls[0][0];
    expect(deployArg.trigger).toBeUndefined();

    // The inbox subscription is persisted on the automation for the worker.
    const persisted = vi.mocked(store.createAutomation).mock.calls[0][0];
    expect(persisted.trigger).toEqual({
      app: "github",
      action: "new_issue",
      inputs: { repo: "owner/name" },
    });
  });

  it("creates a digest WITHOUT a durable + registers a daily-digest schedule (foreman-bhb5)", async () => {
    const result = await provisionAutomation({
      userId: "user-1",
      name: "Morning digest",
      schedule: { cron: "0 9 * * *" },
      digest: true,
    });

    expect(result.id).toBe("auto_1");
    expect(deployAutomation).not.toHaveBeenCalled(); // no Zapier durable for a digest

    const persisted = vi.mocked(store.createAutomation).mock.calls[0][0];
    expect(persisted.trigger).toEqual({ schedule: { cron: "0 9 * * *" }, digest: true });
    expect(persisted.zapierWorkflowId).toMatch(/^foreman:digest:/); // unique sentinel
    expect(persisted.status).toBe("active");

    // Mastra owns the firing — a schedule targeting the digest workflow is registered.
    expect(registerAutomationSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "auto_1",
        workflow: "daily-digest",
        cron: "0 9 * * *",
      }),
    );
  });

  it("deploys a durable for a scheduled automation + registers a run-automation schedule", async () => {
    await provisionAutomation({
      userId: "user-1",
      name: "Nightly sync",
      source: "SRC",
      schedule: { cron: "0 3 * * *", timezone: "America/New_York" },
    });

    expect(deployAutomation).toHaveBeenCalled();
    const persisted = vi.mocked(store.createAutomation).mock.calls[0][0];
    expect(persisted.trigger).toEqual({
      schedule: { cron: "0 3 * * *", timezone: "America/New_York" },
    });
    expect(registerAutomationSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: "auto_1", workflow: "run-automation" }),
    );
  });
});

describe("runAutomationById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the automation isn't in the workspace", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(null);
    const result = await runAutomationById("user-1", "missing");
    expect(result).toBeNull();
  });

  it("triggers and records a run for an existing automation", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce({
      id: "auto_1",
      zapier_workflow_id: "wf_1",
    } as never);

    const result = await runAutomationById("user-1", "auto_1", { x: 1 });
    expect(result).toEqual({
      runId: "run_1",
      triggerId: "trig_1",
      status: "finished",
      durableRunId: "dr_1",
    });
    expect(store.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "auto_1",
        triggerId: "trig_1",
        durableRunId: "dr_1",
      }),
    );
  });
});

describe("cancelRunForUser (foreman-y4kc)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the run isn't in the workspace", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce(null);
    expect(await cancelRunForUser("user-1", "missing")).toBeNull();
    expect(cancelDurableRun).not.toHaveBeenCalled();
  });

  it("no-ops on an already-terminal run", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "finished",
      durable_run_id: "dr_1",
    } as never);
    expect(await cancelRunForUser("user-1", "run_1")).toEqual({
      cancelled: false,
      status: "finished",
    });
    expect(cancelDurableRun).not.toHaveBeenCalled();
    expect(store.updateRun).not.toHaveBeenCalled();
  });

  it("cancels the durable and records the status for a running run", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "started",
      durable_run_id: "dr_1",
    } as never);
    const result = await cancelRunForUser("user-1", "run_1");
    expect(result).toEqual({ cancelled: true, status: "cancelled" });
    expect(cancelDurableRun).toHaveBeenCalledWith(expect.anything(), "dr_1");
    expect(store.updateRun).toHaveBeenCalledWith("run_1", { status: "cancelled" });
  });

  it("cancels locally (no SDK) when the durable hasn't linked yet", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "started",
      durable_run_id: null,
    } as never);
    const result = await cancelRunForUser("user-1", "run_1");
    expect(result).toEqual({ cancelled: true, status: "cancelled" });
    expect(cancelDurableRun).not.toHaveBeenCalled();
    expect(store.updateRun).toHaveBeenCalledWith("run_1", { status: "cancelled" });
  });
});

describe("respondToCallbackForUser (foreman-zfnj)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the run isn't in the workspace", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce(null);
    expect(await respondToCallbackForUser("user-1", "missing", {})).toBeNull();
  });

  it("no-ops (action=none) when the run isn't waiting", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "started",
      durable_run_id: "dr_1",
    } as never);
    const r = await respondToCallbackForUser("user-1", "run_1", { payload: { approved: true } });
    expect(r).toMatchObject({ ok: false, action: "none" });
    expect(resolveCallbackUrl).not.toHaveBeenCalled();
  });

  it("approve → resolves the URL server-side + POSTs the payload", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "waiting",
      durable_run_id: "dr_1",
    } as never);
    vi.mocked(resolveCallbackUrl).mockResolvedValueOnce({
      url: "https://cb.example/abc",
      name: "approve",
    } as never);
    const r = await respondToCallbackForUser("user-1", "run_1", { payload: { approved: true } });
    expect(r).toEqual({ ok: true, action: "resumed", status: 200 });
    expect(postCallback).toHaveBeenCalledWith("https://cb.example/abc", { approved: true });
  });

  it("approve but no reported URL → action=none (nothing POSTed)", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "waiting",
      durable_run_id: "dr_1",
    } as never);
    vi.mocked(resolveCallbackUrl).mockResolvedValueOnce(null);
    const r = await respondToCallbackForUser("user-1", "run_1", { payload: { approved: true } });
    expect(r).toMatchObject({ ok: false, action: "none" });
    expect(postCallback).not.toHaveBeenCalled();
  });

  it("deny (cancel) → cancels the durable run, no callback POST", async () => {
    vi.mocked(store.getRun).mockResolvedValueOnce({
      id: "run_1",
      status: "waiting",
      durable_run_id: "dr_1",
    } as never);
    const r = await respondToCallbackForUser("user-1", "run_1", { cancel: true });
    expect(r).toEqual({ ok: true, action: "cancelled" });
    expect(cancelDurableRun).toHaveBeenCalledWith(expect.anything(), "dr_1");
    expect(store.updateRun).toHaveBeenCalledWith("run_1", { status: "cancelled" });
    expect(postCallback).not.toHaveBeenCalled();
  });
});

describe("getWorkspaceInbox (foreman-6r9y)", () => {
  beforeEach(() => vi.clearAllMocks());

  const automations = [
    // teammate-owned, trigger broken → should rank highest
    {
      id: "auto_b",
      user_id: "user-2",
      name: "Teammate broken",
      enabled: true,
      status: "trigger_failed",
      trigger: { app: "gmail", action: "new_email" },
      trigger_inbox_id: "inbox-b",
    },
    // self-owned, quiet → low priority
    {
      id: "auto_a",
      user_id: "user-1",
      name: "My quiet automation",
      enabled: true,
      status: "active",
      trigger: { app: "sheets", action: "new_row" },
      trigger_inbox_id: "inbox-a",
    },
    // self-owned but no inbox → filtered out entirely
    { id: "auto_c", user_id: "user-1", trigger_inbox_id: null },
  ];

  it("aggregates teammate inboxes with owner attribution and ranks by priority", async () => {
    vi.mocked(store.listAutomations).mockResolvedValueOnce(automations as never);
    vi.mocked(getInbox).mockResolvedValue({ status: "active", paused_reason: null } as never);
    vi.mocked(listInboxMessages).mockResolvedValue([] as never);

    const { entries } = await getWorkspaceInbox("user-1");

    // auto_c has no inbox → dropped; the other two remain.
    expect(entries.map((e) => e.automation.id)).toEqual(["auto_b", "auto_a"]);

    // Highest-priority first: the teammate's broken trigger outranks the quiet one.
    expect(entries[0].automation.id).toBe("auto_b");
    expect(entries[0].priority.level).toBe("high");
    expect(entries[0].owner).toEqual({ userId: "user-2", isSelf: false });

    expect(entries[1].priority.level).toBe("low");
    expect(entries[1].owner).toEqual({ userId: "user-1", isSelf: true });

    // Each inbox is read with its OWNER's SDK, resolved once per distinct owner.
    expect(getExperimentalSdkForUser).toHaveBeenCalledWith("user-1");
    expect(getExperimentalSdkForUser).toHaveBeenCalledWith("user-2");
    expect(getExperimentalSdkForUser).toHaveBeenCalledTimes(2);
  });

  it("degrades an un-connected owner to an empty entry instead of failing", async () => {
    vi.mocked(store.listAutomations).mockResolvedValueOnce([automations[1]] as never);
    vi.mocked(getExperimentalSdkForUser).mockRejectedValueOnce(new Error("reauth required"));

    const { entries } = await getWorkspaceInbox("user-1");

    expect(entries).toHaveLength(1);
    expect(entries[0].inbox).toBeNull();
    expect(entries[0].messages).toEqual([]);
    expect(getInbox).not.toHaveBeenCalled();
  });

  it("returns no entries but still the latest digest when there are no inbox automations", async () => {
    vi.mocked(store.listAutomations).mockResolvedValueOnce([automations[2]] as never);
    const fakeDigest = { kind: "automation_digest", headline: "2 runs · 2 ok" };
    vi.mocked(store.getLatestDigest).mockResolvedValueOnce(fakeDigest as never);
    expect(await getWorkspaceInbox("user-1")).toEqual({ entries: [], digest: fakeDigest });
    expect(getExperimentalSdkForUser).not.toHaveBeenCalled();
  });
});

describe("removeAutomationForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when nothing was deleted", async () => {
    vi.mocked(store.deleteAutomation).mockResolvedValueOnce(null);
    expect(await removeAutomationForUser("user-1", "missing")).toBe(false);
    expect(deleteZapierWorkflow).not.toHaveBeenCalled();
  });

  it("deletes the row and best-effort removes the Zapier workflow", async () => {
    vi.mocked(store.deleteAutomation).mockResolvedValueOnce({
      id: "auto_1",
      zapier_workflow_id: "wf_1",
    } as never);
    expect(await removeAutomationForUser("user-1", "auto_1")).toBe(true);
    expect(deleteZapierWorkflow).toHaveBeenCalledWith(expect.anything(), "wf_1");
  });
});
