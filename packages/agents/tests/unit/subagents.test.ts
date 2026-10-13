/**
 * The AgentController's subagents run with requireToolApproval: false, so every
 * tool they get must be a read. This guards that for all of them, including the
 * Files, Automations and Tables specialists.
 */
import { describe, expect, it } from "vitest";
import { FOREMAN_SUBAGENTS, TABLE_READ_TOOL_NAMES } from "@/mastra/lib/subagents";
import { ZAPIER_APPROVAL_TOOL_IDS } from "@/mastra/lib/tool-categories";

const toolsOf = (id: string) =>
  (FOREMAN_SUBAGENTS.find((s) => s.id === id)?.tools ?? {}) as Record<string, any>;

describe("FOREMAN_SUBAGENTS", () => {
  it("registers the read-only specialists", () => {
    expect(FOREMAN_SUBAGENTS.map((s) => s.id)).toEqual([
      "discovery",
      "history",
      "files",
      "automations",
      "tables",
    ]);
  });

  it("gives no subagent a write tool or workspace tools", () => {
    for (const subagent of FOREMAN_SUBAGENTS) {
      expect(subagent.allowedWorkspaceTools, subagent.id).toEqual([]);
      for (const [name, tool] of Object.entries(subagent.tools ?? {})) {
        expect(ZAPIER_APPROVAL_TOOL_IDS, `${subagent.id}/${name}`).not.toContain(name);
        expect((tool as any)?.requireApproval, `${subagent.id}/${name}`).toBeFalsy();
        expect(name, `${subagent.id}/${name}`).not.toMatch(
          /write|append|copy|move|delete|create|update|run|test|set_/,
        );
      }
    }
  });

  it("gives Files only the stored-file reads", () => {
    expect(Object.keys(toolsOf("files")).sort()).toEqual([
      "list_stored_files",
      "read_stored_file",
      "stat_stored_file",
    ]);
  });

  it("gives Tables the Zapier table reads", () => {
    expect(Object.keys(toolsOf("tables")).sort()).toEqual([...TABLE_READ_TOOL_NAMES].sort());
  });

  it("reads the automation owner from the run, never from the model's input", () => {
    for (const tool of Object.values(toolsOf("automations"))) {
      const shape = (tool as any).inputSchema?.shape ?? {};
      expect(Object.keys(shape)).not.toContain("userId");
    }
  });
});
