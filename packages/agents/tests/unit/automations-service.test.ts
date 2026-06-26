/**
 * Unit tests for the automation service (foreman-l7xq M2) — the deploy+persist
 * orchestration shared by the agent tools and the web routes. Mocks the durable
 * layer, the store, identity, and the SDK resolver.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/identity", () => ({ resolveActiveWorkspace: vi.fn(async () => "ws-1") }));
vi.mock("@/lib/zapier/sdk", () => ({ getExperimentalSdkForUser: vi.fn(async () => ({})) }));
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
}));
vi.mock("@/lib/automations/store", () => ({
  createAutomation: vi.fn(async () => "auto_1"),
  getAutomation: vi.fn(),
  listAutomations: vi.fn(async () => [{ id: "auto_1" }]),
  listRuns: vi.fn(async () => []),
  recordRun: vi.fn(async () => "run_1"),
  deleteAutomation: vi.fn(),
  updateAutomation: vi.fn(async () => true),
}));

import {
  provisionAutomation,
  removeAutomationForUser,
  runAutomationById,
} from "@/lib/automations/service";
import * as store from "@/lib/automations/store";
import { deleteAutomation as deleteZapierWorkflow, deployAutomation } from "@/lib/durable";

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

  it("records a silent trigger-claim failure as status=trigger_claim_failed", async () => {
    vi.mocked(deployAutomation).mockResolvedValueOnce({
      workflowId: "wf_2",
      versionId: "ver_2",
      enabled: false,
      isPrivate: true,
      editorUrl: "e",
      triggerUrl: "t",
      triggerClaimFailed: true,
      disabledReason: "trigger_claim_failed",
    });

    await provisionAutomation({
      userId: "user-1",
      name: "Triggered",
      source: "SRC",
      trigger: { selectedApi: "GoogleSheetsAPI@2.3.0", action: "new_row" },
    });

    const persisted = vi.mocked(store.createAutomation).mock.calls[0][0];
    expect(persisted.status).toBe("trigger_claim_failed");
    expect(persisted.enabled).toBe(false);
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
