/**
 * Unit tests for the durable source generator (foreman-l7xq M1).
 * Pure string generation — no SDK, no network.
 */
import { describe, expect, it } from "vitest";
import { AGED_DURABLE_DEPS, buildDurableSource, humanApprovalGate } from "../../src/lib/durable";

describe("buildDurableSource", () => {
  const source = buildDurableSource({
    name: "notify-on-row",
    steps: [
      {
        id: "send-slack",
        appKey: "SlackCLIAPI",
        actionType: "write",
        actionKey: "send_message",
        connection: "slack_work",
        inputs: { channel: "#general", text: "hi" },
      },
    ],
  });

  it("emits the parser-friendly durable shape", () => {
    expect(source).toContain('import { defineDurable } from "@zapier/zapier-durable";');
    expect(source).toContain('import { createZapierSdk } from "@zapier/zapier-sdk";');
    expect(source).toContain("const sdk = createZapierSdk();");
    expect(source).toContain('defineDurable("notify-on-row", async (ctx) => {');
    expect(source).toContain("export default workflow;");
  });

  it("emits one runAction step per app action with hoisted literals", () => {
    expect(source).toContain('ctx.step("send-slack"');
    expect(source).toContain('appKey: "SlackCLIAPI"');
    expect(source).toContain('actionType: "write"');
    expect(source).toContain('actionKey: "send_message"');
    expect(source).toContain('connection: "slack_work"');
    expect(source).toContain('"channel":"#general"');
  });

  it("returns each step's result", () => {
    expect(source).toContain("return { step_0 };");
  });

  it("generates a multi-step return", () => {
    const multi = buildDurableSource({
      name: "two-step",
      steps: [
        { id: "a", appKey: "X", actionType: "read", actionKey: "r", connection: "c" },
        { id: "b", appKey: "Y", actionType: "write", actionKey: "w", connection: "c" },
      ],
    });
    expect(multi).toContain("return { step_0, step_1 };");
    expect(multi).toContain('ctx.step("a"');
    expect(multi).toContain('ctx.step("b"');
  });

  it("pins aged dependency versions", () => {
    expect(AGED_DURABLE_DEPS.sdk).toMatch(/^\d+\.\d+\.\d+$/);
    expect(AGED_DURABLE_DEPS.durable).toMatch(/^\d+\.\d+\.\d+$/);
    expect(AGED_DURABLE_DEPS.zod).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("humanApprovalGate (foreman-zfnj)", () => {
  it("creates the gate, reports its URL+name via a step, and awaits the decision", () => {
    const gate = humanApprovalGate("approve", "zapier");
    expect(gate).toContain(
      'const [approveApproval, approveUrl] = await ctx.createCallback("approve");',
    );
    // The report step is what resolveCallbackUrl reads to find the URL.
    expect(gate).toContain('ctx.step("__report_callback_url_approve"');
    expect(gate).toContain("callbackUrl: approveUrl");
    expect(gate).toContain('callbackName: "approve"');
    expect(gate).toContain("const approveDecision = await approveApproval;");
  });

  it("omits the report step on the filesystem adapter (foreman-2qbk)", () => {
    const gate = humanApprovalGate("approve", "filesystem");
    // The gate itself is identical…
    expect(gate).toContain('await ctx.createCallback("approve")');
    expect(gate).toContain("const approveDecision = await approveApproval;");
    // …but the URL never crosses a wire locally, so nothing reports it and the
    // URL is not even bound (an unused binding would be dead weight in the
    // generated source). Foreman reads the token off the local operations.
    expect(gate).not.toContain("__report_callback_url");
    expect(gate).not.toContain("approveUrl");
  });

  it("defaults to the active adapter, which is zapier unless opted out", () => {
    delete process.env.ZAPIER_DURABLE_ADAPTER;
    expect(humanApprovalGate("approve")).toContain("__report_callback_url_approve");
  });

  it("sanitizes a non-identifier name into safe variable names", () => {
    const gate = humanApprovalGate("needs-sign-off", "zapier");
    // createCallback + callbackName keep the original name…
    expect(gate).toContain('ctx.createCallback("needs-sign-off")');
    expect(gate).toContain('callbackName: "needs-sign-off"');
    // …but the JS variables are sanitized.
    expect(gate).toContain("needs_sign_offApproval");
    expect(gate).toContain("needs_sign_offUrl");
  });
});
