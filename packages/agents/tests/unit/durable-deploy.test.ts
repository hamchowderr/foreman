/**
 * Unit tests for the durable deploy/run layer (foreman-l7xq M1).
 * Drives the functions against a fake experimental SDK — no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AGED_DURABLE_DEPS,
  cancelDurableRun,
  deployAutomation,
  getDurableRunStatus,
  inspectAutomation,
  listAutomations,
  runAutomationOnce,
  triggerAutomation,
} from "../../src/lib/durable";
import type { ExperimentalZapierSdk } from "../../src/lib/zapier/sdk";

function fakeSdk(overrides: Record<string, unknown>): ExperimentalZapierSdk {
  return overrides as unknown as ExperimentalZapierSdk;
}

describe("deployAutomation", () => {
  it("creates + publishes, shapes connections/deps, returns the editor link (no trigger → no re-read)", async () => {
    const sdk = fakeSdk({
      createWorkflow: vi.fn(async () => ({
        data: { id: "wf_1", trigger_url: "https://trig/x", enabled: false, is_private: true },
      })),
      publishWorkflowVersion: vi.fn(async () => ({ data: { id: "ver_1", workflow_id: "wf_1" } })),
      getWorkflow: vi.fn(),
    });

    const res = await deployAutomation({
      sdk,
      name: "Test",
      description: "d",
      source: "SRC",
      connections: { slack_work: "123" },
      enabled: true,
    });

    expect(res.workflowId).toBe("wf_1");
    expect(res.versionId).toBe("ver_1");
    expect(res.editorUrl).toBe("https://zapier.com/durables-editor/wf_1");
    expect(res.triggerUrl).toBe("https://trig/x");
    expect(res.triggerClaimFailed).toBe(false);
    // No trigger requested → no verification re-read.
    expect((sdk.getWorkflow as ReturnType<typeof vi.fn>) ?? vi.fn()).not.toHaveBeenCalled();

    const pubArg = (sdk.publishWorkflowVersion as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pubArg.sourceFiles["workflow.ts"]).toBe("SRC");
    expect(pubArg.dependencies["@zapier/zapier-sdk"]).toBe(AGED_DURABLE_DEPS.sdk);
    expect(pubArg.dependencies.zod).toBe(AGED_DURABLE_DEPS.zod);
    expect(pubArg.zapierDurableVersion).toBe(AGED_DURABLE_DEPS.durable);
    expect(pubArg.connections).toEqual({ slack_work: { connectionId: "123" } });
    expect(pubArg.trigger).toBeUndefined();
  });

  it("verifies the trigger claim and flags a silent failure", async () => {
    const sdk = fakeSdk({
      createWorkflow: vi.fn(async () => ({
        data: { id: "wf_2", trigger_url: "https://trig/y", enabled: false, is_private: true },
      })),
      publishWorkflowVersion: vi.fn(async () => ({ data: { id: "ver_2", workflow_id: "wf_2" } })),
      getWorkflow: vi.fn(async () => ({
        data: {
          id: "wf_2",
          enabled: false,
          disabled_reason: "trigger_claim_failed",
          triggers: [{ status: "failed" }],
        },
      })),
    });

    const res = await deployAutomation({
      sdk,
      name: "Triggered",
      source: "SRC",
      trigger: { selectedApi: "GoogleSheetsAPI@2.3.0", action: "new_row" },
      enabled: true,
    });

    expect(sdk.getWorkflow).toHaveBeenCalledWith({ workflow: "wf_2" });
    expect(res.triggerClaimFailed).toBe(true);
    expect(res.enabled).toBe(false);
    expect(res.disabledReason).toBe("trigger_claim_failed");

    const pubArg = (sdk.publishWorkflowVersion as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pubArg.trigger).toEqual({
      action: "new_row",
      selectedApi: "GoogleSheetsAPI@2.3.0",
      authenticationId: null,
      params: undefined,
    });
  });
});

describe("runAutomationOnce", () => {
  it("runs ephemeral durable source with aged deps + private", async () => {
    const sdk = fakeSdk({
      runDurable: vi.fn(async () => ({ data: { id: "run_1", status: "initialized" } })),
    });
    const res = await runAutomationOnce({ sdk, source: "SRC", input: { a: 1 } });
    expect(res).toEqual({ runId: "run_1", status: "initialized" });
    const arg = (sdk.runDurable as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.sourceFiles["workflow.ts"]).toBe("SRC");
    expect(arg.private).toBe(true);
    expect(arg.zapierDurableVersion).toBe(AGED_DURABLE_DEPS.durable);
  });
});

describe("triggerAutomation", () => {
  it("fires a workflow and returns the trigger id", async () => {
    const sdk = fakeSdk({
      triggerWorkflow: vi.fn(async () => ({ data: { id: "trig_1", workflow_id: "wf_1" } })),
    });
    const res = await triggerAutomation({ sdk, workflowId: "wf_1", input: { x: 1 } });
    expect(res).toEqual({ triggerId: "trig_1" });
    expect(sdk.triggerWorkflow).toHaveBeenCalledWith({ workflow: "wf_1", input: { x: 1 } });
  });
});

describe("cancelDurableRun (foreman-y4kc)", () => {
  it("cancels a run and returns the resulting status", async () => {
    const sdk = fakeSdk({
      cancelDurableRun: vi.fn(async () => ({ data: { id: "dr_1", status: "cancelled" } })),
    });
    const status = await cancelDurableRun(sdk, "dr_1");
    expect(status).toBe("cancelled");
    expect(sdk.cancelDurableRun).toHaveBeenCalledWith({ run: "dr_1" });
  });
});

describe("resolveCallbackUrl + postCallback (foreman-zfnj)", () => {
  const runWith = (operations: unknown[]) => ({
    data: { id: "r", status: "started", output: null, error: null, execution: { operations } },
  });

  it("returns the URL a step reported for a still-pending callback", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runWith([
          {
            name: "approve",
            type: "callback",
            status: "pending",
            callback_token: "tok_1",
            payload_schema: { type: "object" },
          },
          {
            name: "__report_callback_url_approve",
            type: "step",
            status: "completed",
            result: { callbackUrl: "https://cb.example/abc", callbackName: "approve" },
          },
        ]),
      ),
    });
    const { resolveCallbackUrl } = await import("../../src/lib/durable");
    const cb = await resolveCallbackUrl(sdk, "dr_1");
    expect(cb).toEqual({
      url: "https://cb.example/abc",
      name: "approve",
      payloadSchema: { type: "object" },
    });
  });

  it("returns null when the callback op is no longer pending", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runWith([
          { name: "approve", type: "callback", status: "completed", callback_token: "tok_1" },
          { name: "x", type: "step", status: "completed", result: { callbackUrl: "https://x" } },
        ]),
      ),
    });
    const { resolveCallbackUrl } = await import("../../src/lib/durable");
    expect(await resolveCallbackUrl(sdk, "dr_1")).toBeNull();
  });

  it("returns null when no step reported a URL", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runWith([{ name: "approve", type: "callback", status: "pending", callback_token: "t" }]),
      ),
    });
    const { resolveCallbackUrl } = await import("../../src/lib/durable");
    expect(await resolveCallbackUrl(sdk, "dr_1")).toBeNull();
  });

  it("postCallback POSTs JSON and returns ok/status", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    const { postCallback } = await import("../../src/lib/durable");
    const res = await postCallback("https://cb.example/abc", { approved: true });
    expect(res).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cb.example/abc",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ approved: true }) }),
    );
    vi.unstubAllGlobals();
  });
});

describe("getDurableRunStatus — execution detail (foreman-jc12)", () => {
  const runData = (execution: unknown, status = "started") => ({
    data: { id: "r", status, output: null, error: null, execution },
  });

  it("returns null detail for a clean, still-running execution", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runData({
          id: "e",
          name: "n",
          status: "running",
          input: null,
          created_at: "t",
          summary: { total_attempts: 1 },
          operations: [
            {
              id: "o",
              execution_id: "e",
              name: "step",
              type: "run",
              status: "success",
              retry_count: 0,
              created_at: "t",
            },
          ],
        }),
      ),
    });
    const res = await getDurableRunStatus(sdk, "r");
    expect(res).toMatchObject({ status: "started", detail: null });
  });

  it("extracts last_error + only the retrying/failed ops", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runData({
          id: "e",
          name: "n",
          status: "running",
          input: null,
          created_at: "t",
          summary: {
            total_attempts: 3,
            last_error: { code: "RATE_LIMIT", title: "Too many requests", detail: "retry later" },
          },
          operations: [
            {
              id: "o1",
              execution_id: "e",
              name: "post-slack",
              type: "run",
              status: "retrying",
              retry_count: 2,
              max_attempts: 5,
              next_retry_at: "2026-07-05T00:00:00Z",
              created_at: "t",
              error: { message: "429" },
            },
            {
              id: "o2",
              execution_id: "e",
              name: "read-row",
              type: "read",
              status: "success",
              retry_count: 0,
              created_at: "t",
            },
          ],
        }),
      ),
    });
    const res = await getDurableRunStatus(sdk, "r");
    expect(res.detail).toEqual({
      totalAttempts: 3,
      lastError: { code: "RATE_LIMIT", title: "Too many requests", detail: "retry later" },
      retrying: [
        {
          name: "post-slack",
          type: "run",
          status: "retrying",
          retryCount: 2,
          maxAttempts: 5,
          nextRetryAt: "2026-07-05T00:00:00Z",
          error: { message: "429" },
        },
      ],
    });
  });

  it("surfaces the waiting-on-callback gate (foreman-rm8z)", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () =>
        runData({
          id: "e",
          name: "n",
          status: "waiting",
          input: null,
          created_at: "t",
          summary: { total_attempts: 1 },
          operations: [
            {
              id: "o1",
              execution_id: "e",
              name: "approve-refund",
              type: "callback",
              status: "waiting",
              retry_count: 0,
              created_at: "t",
              callback_token: "cb_abc",
              payload_schema: { type: "object" },
              expires_at: "2026-07-06T00:00:00Z",
            },
          ],
        }),
      ),
    });
    const res = await getDurableRunStatus(sdk, "r");
    expect(res.detail?.waiting).toBe(true);
    expect(res.detail?.callbacks).toEqual([
      {
        name: "approve-refund",
        status: "waiting",
        callbackToken: "cb_abc",
        payloadSchema: { type: "object" },
        resumeAt: undefined,
        expiresAt: "2026-07-06T00:00:00Z",
      },
    ]);
  });

  it("returns null detail when there is no execution", async () => {
    const sdk = fakeSdk({
      getDurableRun: vi.fn(async () => ({
        data: { id: "r", status: "finished", output: { ok: true }, error: null, execution: null },
      })),
    });
    const res = await getDurableRunStatus(sdk, "r");
    expect(res.detail).toBeNull();
    expect(res.output).toEqual({ ok: true });
  });
});

describe("listAutomations / inspectAutomation", () => {
  it("maps listWorkflows into summaries with editor links", async () => {
    const sdk = fakeSdk({
      listWorkflows: vi.fn(async () => ({
        data: [{ id: "wf_1", name: "A", enabled: true, is_private: false, triggers: [] }],
      })),
    });
    const list = await listAutomations(sdk);
    expect(list).toEqual([
      {
        id: "wf_1",
        name: "A",
        enabled: true,
        isPrivate: false,
        editorUrl: "https://zapier.com/durables-editor/wf_1",
        triggers: [],
      },
    ]);
  });

  it("returns workflow + recent runs", async () => {
    const sdk = fakeSdk({
      getWorkflow: vi.fn(async () => ({ data: { id: "wf_1", enabled: true } })),
      listWorkflowRuns: vi.fn(async () => ({ data: [{ id: "run_1", status: "finished" }] })),
    });
    const res = await inspectAutomation(sdk, "wf_1", 5);
    expect((res.workflow as { id: string }).id).toBe("wf_1");
    expect(res.runs).toHaveLength(1);
    expect(sdk.listWorkflowRuns).toHaveBeenCalledWith({ workflow: "wf_1", maxItems: 5 });
  });
});
