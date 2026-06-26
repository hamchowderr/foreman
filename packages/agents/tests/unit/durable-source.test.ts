/**
 * Unit tests for the durable source generator (foreman-l7xq M1).
 * Pure string generation — no SDK, no network.
 */
import { describe, expect, it } from "vitest";
import { AGED_DURABLE_DEPS, buildDurableSource } from "../../src/lib/durable";

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
