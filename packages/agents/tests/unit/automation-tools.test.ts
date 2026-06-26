/**
 * Unit tests for the durable-automation agent tools (foreman-l7xq M1).
 * Confirms the tools are registered with the right ids, approval gating, and
 * schemas — the surface the foreman agent exposes for authoring automations.
 */
import { describe, expect, it } from "vitest";
import {
  createAutomationTool,
  inspectAutomationTool,
  listAutomationsTool,
  runAutomationTool,
} from "../../src/mastra/tools/automations";

const allTools = [
  createAutomationTool,
  runAutomationTool,
  listAutomationsTool,
  inspectAutomationTool,
];

describe("automation tools", () => {
  it("expose the expected tool ids", () => {
    expect(createAutomationTool.id).toBe("create_automation");
    expect(runAutomationTool.id).toBe("run_automation");
    expect(listAutomationsTool.id).toBe("list_automations");
    expect(inspectAutomationTool.id).toBe("inspect_automation");
  });

  it("gate the write tools behind approval and leave reads open", () => {
    expect(createAutomationTool.requireApproval).toBe(true);
    expect(runAutomationTool.requireApproval).toBe(true);
    expect(listAutomationsTool.requireApproval).toBeFalsy();
    expect(inspectAutomationTool.requireApproval).toBeFalsy();
  });

  it("declare input and output schemas", () => {
    for (const tool of allTools) {
      expect(tool.inputSchema, `${tool.id} inputSchema`).toBeDefined();
      expect(tool.outputSchema, `${tool.id} outputSchema`).toBeDefined();
    }
  });
});
