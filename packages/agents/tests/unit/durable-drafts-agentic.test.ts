/**
 * Unit tests for draft test runs + agentic management in the durable layer
 * (SDK 0.110 drafts / 0.112 agentic management). Fake experimental SDK — no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AGED_DURABLE_DEPS,
  deployAutomation,
  getAutomationManagement,
  getWorkflowRunStatus,
  inspectAutomation,
  listWorkflowRunsByKind,
  publishAutomationDraft,
  setAutomationManagement,
  testAutomationDraft,
} from "../../src/lib/durable";
import type { ExperimentalZapierSdk } from "../../src/lib/zapier/sdk";

function fakeSdk(overrides: Record<string, unknown>): ExperimentalZapierSdk {
  return overrides as unknown as ExperimentalZapierSdk;
}

function draftSdk(extra: Record<string, unknown> = {}) {
  return fakeSdk({
    createWorkflowDraft: vi.fn(async () => ({ data: { id: "dr_1", draft_revision: 1 } })),
    updateWorkflowDraft: vi.fn(async () => ({ data: { id: "dr_1", draft_revision: 2 } })),
    runWorkflowDraft: vi.fn(async () => ({
      data: {
        id: "run_d1",
        kind: "draft",
        status: "initialized",
        durable_run_id: null,
        draft_revision: 2,
      },
    })),
    discardWorkflowDraft: vi.fn(async () => ({ data: { id: "dr_1", status: "discarded" } })),
    ...extra,
  });
}

describe("testAutomationDraft", () => {
  it("forks a draft, saves the source, runs that exact revision, then discards the draft", async () => {
    const sdk = draftSdk();
    const res = await testAutomationDraft({
      sdk,
      workflowId: "wf_1",
      source: "SRC",
      input: { a: 1 },
      connections: { slack_work: "123" },
    });

    expect(res).toEqual({
      kind: "draft",
      runId: "run_d1",
      status: "initialized",
      durableRunId: null,
      draftId: "dr_1",
      draftRevision: 2,
    });

    const upd = vi.mocked(sdk.updateWorkflowDraft).mock.calls[0][0];
    expect(upd.workflow).toBe("wf_1");
    expect(upd.draft).toBe("dr_1");
    expect(upd.sourceFiles).toEqual({ "workflow.ts": "SRC" });
    expect(upd.dependencies?.["@zapier/zapier-sdk"]).toBe(AGED_DURABLE_DEPS.sdk);
    expect(upd.zapierDurableVersion).toBe(AGED_DURABLE_DEPS.durable);
    expect(upd.draftRevision).toBe(1);
    expect(upd.manual).toBe(true);
    expect(upd.connections).toEqual({ slack_work: { connectionId: "123" } });

    // Runs the revision the SAVE returned, not the fork's.
    expect(sdk.runWorkflowDraft).toHaveBeenCalledWith({
      workflow: "wf_1",
      draft: "dr_1",
      draftRevision: 2,
      input: { a: 1 },
    });
    expect(sdk.discardWorkflowDraft).toHaveBeenCalledWith({ workflow: "wf_1", draft: "dr_1" });
  });

  it("still discards the draft when the run is rejected", async () => {
    const sdk = draftSdk({
      runWorkflowDraft: vi.fn(async () => {
        throw new Error("rate limited");
      }),
    });
    await expect(testAutomationDraft({ sdk, workflowId: "wf_1", source: "SRC" })).rejects.toThrow(
      "rate limited",
    );
    expect(sdk.discardWorkflowDraft).toHaveBeenCalledOnce();
  });

  it("keeps the draft when asked, and a failed discard never fails the test", async () => {
    const kept = draftSdk();
    await testAutomationDraft({ sdk: kept, workflowId: "wf_1", source: "SRC", keepDraft: true });
    expect(kept.discardWorkflowDraft).not.toHaveBeenCalled();

    const flaky = draftSdk({
      discardWorkflowDraft: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const res = await testAutomationDraft({ sdk: flaky, workflowId: "wf_1", source: "SRC" });
    expect(res.runId).toBe("run_d1");
  });

  it("waits for the run's result when asked (SDK 0.119.0 waitSeconds)", async () => {
    const sdk = draftSdk();
    vi.mocked(sdk.runWorkflowDraft).mockResolvedValueOnce({
      data: {
        id: "run_d1",
        kind: "draft",
        status: "finished",
        durable_run_id: "dur_1",
        draft_revision: 2,
        output: { ok: true },
        error: null,
      },
    } as never);
    const res = await testAutomationDraft({
      sdk,
      workflowId: "wf_1",
      source: "SRC",
      waitSeconds: 30,
    });
    expect(vi.mocked(sdk.runWorkflowDraft).mock.calls[0][0]).toMatchObject({ waitSeconds: 30 });
    expect(res).toMatchObject({ status: "finished", output: { ok: true }, error: null });
  });
});

describe("publishAutomationDraft / getWorkflowRunStatus", () => {
  it("publishes the tested revision and returns the new version id", async () => {
    const sdk = fakeSdk({
      publishWorkflowDraft: vi.fn(async () => ({ data: { version: { id: "ver_9" }, draft: {} } })),
    });
    const res = await publishAutomationDraft({
      sdk,
      workflowId: "wf_1",
      draftId: "dr_1",
      draftRevision: 2,
    });
    expect(res).toEqual({ versionId: "ver_9" });
    expect(sdk.publishWorkflowDraft).toHaveBeenCalledWith({
      workflow: "wf_1",
      draft: "dr_1",
      draftRevision: 2,
      enabled: undefined,
    });
  });

  it("reads a run's kind + status", async () => {
    const sdk = fakeSdk({
      getWorkflowRun: vi.fn(async () => ({
        data: { kind: "draft", status: "finished", durable_run_id: "d1", output: 1, error: null },
      })),
    });
    const res = await getWorkflowRunStatus(sdk, "run_d1", "wf_1");
    expect(res).toEqual({
      kind: "draft",
      status: "finished",
      durableRunId: "d1",
      output: 1,
      error: null,
    });
    expect(sdk.getWorkflowRun).toHaveBeenCalledWith({ run: "run_d1", workflow: "wf_1" });
  });
});

describe("run kind surfacing", () => {
  const rows = [
    {
      id: "r2",
      kind: "draft",
      status: "finished",
      durable_run_id: "d2",
      input: null,
      error: null,
      created_at: "2026-01-02",
      updated_at: "2026-01-02",
      workflow_draft_id: "dr_1",
      draft_revision: 3,
    },
    {
      id: "r1",
      kind: "live",
      status: "failed",
      durable_run_id: "d1",
      input: null,
      error: { code: "x" },
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      trigger_id: "t1",
      workflow_version_id: "v1",
    },
  ];

  it("maps each run with an explicit kind and kind-specific fields", async () => {
    const sdk = fakeSdk({ listWorkflowRuns: vi.fn(async () => ({ data: rows })) });
    const runs = await listWorkflowRunsByKind(sdk, "wf_1");
    expect(runs.map((r) => r.kind)).toEqual(["draft", "live"]);
    expect(runs[0]).toMatchObject({ workflowDraftId: "dr_1", draftRevision: 3 });
    expect(runs[1]).toMatchObject({ triggerId: "t1", workflowVersionId: "v1" });
    expect(sdk.listWorkflowRuns).toHaveBeenCalledWith({ workflow: "wf_1", maxItems: 10 });
  });

  it("inspectAutomation forwards a kind filter", async () => {
    const sdk = fakeSdk({
      getWorkflow: vi.fn(async () => ({ data: { id: "wf_1" } })),
      listWorkflowRuns: vi.fn(async () => ({ data: [rows[1]] })),
    });
    const res = await inspectAutomation(sdk, "wf_1", 5, "live");
    expect(res.runs[0].kind).toBe("live");
    expect(sdk.listWorkflowRuns).toHaveBeenCalledWith({
      workflow: "wf_1",
      maxItems: 5,
      kind: "live",
    });
  });
});

describe("deployAutomation → agentic-management intent", () => {
  const base = () => ({
    createWorkflow: vi.fn(async () => ({ data: { id: "wf_1", trigger_url: "u" } })),
    publishWorkflowVersion: vi.fn(async () => ({ data: { id: "ver_1" } })),
  });

  it("records the description as the new version's intent", async () => {
    const sdk = fakeSdk({
      ...base(),
      updateAgenticManagementIntent: vi.fn(async () => ({ data: {} })),
    });
    await deployAutomation({ sdk, name: "N", description: "  Post issues to Slack ", source: "S" });
    expect(sdk.updateAgenticManagementIntent).toHaveBeenCalledWith({
      workflow: "wf_1",
      version: "ver_1",
      intent: "Post issues to Slack",
    });
  });

  it("does not fail the deploy when the intent call fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sdk = fakeSdk({
      ...base(),
      updateAgenticManagementIntent: vi.fn(async () => {
        throw new Error("403");
      }),
    });
    const res = await deployAutomation({ sdk, name: "N", description: "d", source: "S" });
    expect(res.versionId).toBe("ver_1");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("skips the intent call without a description", async () => {
    const sdk = fakeSdk({ ...base(), updateAgenticManagementIntent: vi.fn() });
    await deployAutomation({ sdk, name: "N", source: "S" });
    expect(sdk.updateAgenticManagementIntent).not.toHaveBeenCalled();
  });
});

describe("agentic management", () => {
  function mgmtSdk(extra: Record<string, unknown> = {}) {
    return fakeSdk({
      enableAgenticManagement: vi.fn(async () => ({ data: { manager_id: "m1" } })),
      disableAgenticManagement: vi.fn(async () => ({ data: { ok: true } })),
      updateAgenticManagementConfig: vi.fn(async () => ({ data: {} })),
      updateAgenticManagementIntent: vi.fn(async () => ({ data: {} })),
      getAgenticManagementConfig: vi.fn(async () => ({
        data: {
          workflow_id: "wf_1",
          enabled: true,
          auto_approve: false,
          modes: ["heal"],
          manager_id: "m1",
        },
      })),
      getAgenticManagementIntent: vi.fn(async () => ({ data: { intent: "do X" } })),
      ...extra,
    });
  }

  it("reads config + intent into one state", async () => {
    const state = await getAutomationManagement(mgmtSdk(), "wf_1");
    expect(state).toEqual({
      enabled: true,
      autoApprove: false,
      modes: ["heal"],
      managerId: "m1",
      intent: "do X",
    });
  });

  it("tolerates an unreadable intent", async () => {
    const sdk = mgmtSdk({
      getAgenticManagementIntent: vi.fn(async () => {
        throw new Error("404");
      }),
    });
    expect((await getAutomationManagement(sdk, "wf_1")).intent).toBeNull();
  });

  it("enabling defaults autoApprove to FALSE (the SDK default would auto-apply)", async () => {
    const sdk = mgmtSdk();
    await setAutomationManagement(sdk, "wf_1", { enabled: true, modes: ["heal", "expand"] });
    expect(sdk.enableAgenticManagement).toHaveBeenCalledWith({
      workflow: "wf_1",
      modes: ["heal", "expand"],
      autoApprove: false,
    });
    expect(sdk.updateAgenticManagementConfig).not.toHaveBeenCalled();
  });

  it("honours an explicit autoApprove on enable", async () => {
    const sdk = mgmtSdk();
    await setAutomationManagement(sdk, "wf_1", { enabled: true, autoApprove: true });
    expect(vi.mocked(sdk.enableAgenticManagement).mock.calls[0][0].autoApprove).toBe(true);
  });

  it("disables, updates config, and records intent independently", async () => {
    const sdk = mgmtSdk();
    await setAutomationManagement(sdk, "wf_1", { enabled: false });
    expect(sdk.disableAgenticManagement).toHaveBeenCalledWith({ workflow: "wf_1" });
    expect(sdk.updateAgenticManagementConfig).not.toHaveBeenCalled();

    await setAutomationManagement(sdk, "wf_1", { modes: ["harden"], intent: " new intent " });
    expect(sdk.updateAgenticManagementConfig).toHaveBeenCalledWith({
      workflow: "wf_1",
      modes: ["harden"],
      autoApprove: undefined,
    });
    expect(sdk.updateAgenticManagementIntent).toHaveBeenCalledWith({
      workflow: "wf_1",
      intent: "new intent",
    });
    expect(sdk.enableAgenticManagement).not.toHaveBeenCalled();
  });
});
