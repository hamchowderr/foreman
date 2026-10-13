/**
 * Unit tests for the durable-automation agent tools (foreman-l7xq M1).
 * Confirms the tools are registered with the right ids, approval gating, and
 * schemas — the surface the foreman agent exposes for authoring automations.
 */
import { describe, expect, it } from "vitest";
import {
  createAutomationTool,
  getAutomationManagementTool,
  inspectAutomationTool,
  listAutomationsTool,
  runAutomationTool,
  setAutomationManagementTool,
  testAutomationTool,
} from "../../src/mastra/tools/automations";

const allTools = [
  createAutomationTool,
  runAutomationTool,
  listAutomationsTool,
  inspectAutomationTool,
  testAutomationTool,
  getAutomationManagementTool,
  setAutomationManagementTool,
];

describe("automation tools", () => {
  it("expose the expected tool ids", () => {
    expect(createAutomationTool.id).toBe("create_automation");
    expect(runAutomationTool.id).toBe("run_automation");
    expect(listAutomationsTool.id).toBe("list_automations");
    expect(inspectAutomationTool.id).toBe("inspect_automation");
    expect(testAutomationTool.id).toBe("test_automation");
    expect(getAutomationManagementTool.id).toBe("get_automation_management");
    expect(setAutomationManagementTool.id).toBe("set_automation_management");
  });

  it("gate the write tools behind approval and leave reads open", () => {
    expect(createAutomationTool.requireApproval).toBe(true);
    expect(runAutomationTool.requireApproval).toBe(true);
    // Draft runs are free but execute connected-app actions for real.
    expect(testAutomationTool.requireApproval).toBe(true);
    expect(setAutomationManagementTool.requireApproval).toBe(true);
    expect(listAutomationsTool.requireApproval).toBeFalsy();
    expect(inspectAutomationTool.requireApproval).toBeFalsy();
    expect(getAutomationManagementTool.requireApproval).toBeFalsy();
  });

  it("declare input and output schemas", () => {
    for (const tool of allTools) {
      expect(tool.inputSchema, `${tool.id} inputSchema`).toBeDefined();
      expect(tool.outputSchema, `${tool.id} outputSchema`).toBeDefined();
    }
  });
});
