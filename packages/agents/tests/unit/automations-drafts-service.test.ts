/**
 * Service-level tests for draft test runs, run-kind surfacing and agentic
 * management. Mocks the durable layer, store, identity and the SDK resolver.
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
vi.mock("@/lib/durable/deploy", () => ({
  AGENTIC_MANAGEMENT_MODES: ["heal", "expand", "harden"],
  testAutomationDraft: vi.fn(async () => ({
    kind: "draft",
    runId: "run_d1",
    status: "initialized",
    durableRunId: null,
    draftId: "dr_1",
    draftRevision: 2,
  })),
  runAutomationOnce: vi.fn(async () => ({ runId: "eph_1", status: "started" })),
  listWorkflowRunsByKind: vi.fn(async () => []),
  getAutomationManagement: vi.fn(async () => ({
    enabled: false,
    autoApprove: false,
    modes: ["heal"],
    managerId: null,
    intent: null,
  })),
  setAutomationManagement: vi.fn(async () => ({
    enabled: true,
    autoApprove: false,
    modes: ["heal"],
    managerId: "m1",
    intent: null,
  })),
}));
vi.mock("@/lib/automations/store", () => ({
  getAutomation: vi.fn(),
  listRuns: vi.fn(async () => []),
}));

import {
  getManagementForUser,
  inspectForUser,
  testAutomationById,
  updateManagementForUser,
} from "@/lib/automations/service";
import * as store from "@/lib/automations/store";
import {
  listWorkflowRunsByKind,
  runAutomationOnce,
  setAutomationManagement,
  testAutomationDraft,
} from "@/lib/durable/deploy";

const automation = {
  id: "auto_1",
  workspace_id: "ws-1",
  zapier_workflow_id: "wf_1",
  source: "STORED",
  connections: { slack: "1" },
};

describe("testAutomationById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ZAPIER_DURABLE_ADAPTER;
  });

  it("returns null for an unknown automation", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(null);
    expect(await testAutomationById("u1", "nope")).toBeNull();
  });

  it("runs the stored source as a draft of the saved workflow", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(automation as never);
    const res = await testAutomationById("u1", "auto_1", { input: { x: 1 } });
    expect(res).toEqual({
      kind: "draft",
      runId: "run_d1",
      status: "initialized",
      durableRunId: null,
    });
    expect(vi.mocked(testAutomationDraft).mock.calls[0][0]).toMatchObject({
      workflowId: "wf_1",
      source: "STORED",
      input: { x: 1 },
      connections: { slack: "1" },
    });
    expect(runAutomationOnce).not.toHaveBeenCalled();
  });

  it("tests an override source when given", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(automation as never);
    await testAutomationById("u1", "auto_1", { source: "EDITED" });
    expect(vi.mocked(testAutomationDraft).mock.calls[0][0].source).toBe("EDITED");
  });

  it("falls back to an ephemeral run when there is no saved workflow", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce({
      ...automation,
      zapier_workflow_id: "",
    } as never);
    const res = await testAutomationById("u1", "auto_1");
    expect(res?.kind).toBe("ephemeral");
    expect(runAutomationOnce).toHaveBeenCalledOnce();
    expect(testAutomationDraft).not.toHaveBeenCalled();
  });

  it("refuses an automation with no source", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce({ ...automation, source: "" } as never);
    await expect(testAutomationById("u1", "auto_1")).rejects.toThrow(/no durable source/);
  });
});

describe("inspectForUser run kinds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ZAPIER_DURABLE_ADAPTER;
  });

  it("tags store runs live and merges Zapier draft runs newest-first", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(automation as never);
    vi.mocked(store.listRuns).mockResolvedValueOnce([
      { id: "live_1", status: "finished", created_at: "2026-01-01T00:00:00Z" },
    ] as never);
    vi.mocked(listWorkflowRunsByKind).mockResolvedValueOnce([
      {
        id: "draft_1",
        kind: "draft",
        status: "started",
        durableRunId: "d1",
        input: null,
        error: null,
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      },
    ]);
    const res = await inspectForUser("u1", "auto_1");
    expect(res?.runs.map((r) => [r.id, r.kind])).toEqual([
      ["draft_1", "draft"],
      ["live_1", "live"],
    ]);
    expect(vi.mocked(listWorkflowRunsByKind).mock.calls[0][2]).toMatchObject({ kind: "draft" });
  });

  it("still returns live runs when the Zapier draft listing fails", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(automation as never);
    vi.mocked(store.listRuns).mockResolvedValueOnce([
      { id: "live_1", status: "finished", created_at: "2026-01-01T00:00:00Z" },
    ] as never);
    vi.mocked(listWorkflowRunsByKind).mockRejectedValueOnce(new Error("401"));
    const res = await inspectForUser("u1", "auto_1");
    expect(res?.runs).toHaveLength(1);
    expect(res?.runs[0].kind).toBe("live");
  });

  it("skips Zapier for digest automations", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce({
      ...automation,
      zapier_workflow_id: "foreman:digest:abc",
    } as never);
    await inspectForUser("u1", "auto_1");
    expect(listWorkflowRunsByKind).not.toHaveBeenCalled();
  });
});

describe("agentic management service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an unknown automation", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce(null);
    expect(await getManagementForUser("u1", "nope")).toBeNull();
  });

  it("reads and updates against the automation's Zapier workflow", async () => {
    vi.mocked(store.getAutomation).mockResolvedValue(automation as never);
    expect((await getManagementForUser("u1", "auto_1"))?.modes).toEqual(["heal"]);
    const res = await updateManagementForUser("u1", "auto_1", { enabled: true });
    expect(res?.enabled).toBe(true);
    expect(vi.mocked(setAutomationManagement).mock.calls[0][1]).toBe("wf_1");
    expect(vi.mocked(setAutomationManagement).mock.calls[0][2]).toEqual({ enabled: true });
  });

  it("rejects digest automations (no Zapier workflow)", async () => {
    vi.mocked(store.getAutomation).mockResolvedValueOnce({
      ...automation,
      zapier_workflow_id: "foreman:digest:abc",
    } as never);
    await expect(getManagementForUser("u1", "auto_1")).rejects.toThrow(/deployed Zapier workflow/);
  });
});
