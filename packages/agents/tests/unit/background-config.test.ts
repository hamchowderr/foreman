/**
 * Unit test for the agent-level background opt-in (foreman-7am4). Read-only tools
 * (Zapier reads + search_history) run as Mastra background tasks; writes are
 * excluded. There is no env gate.
 */
import { describe, expect, it } from "vitest";
import { backgroundToolsConfig } from "@/lib/background";
import { READ_ONLY_TOOL_IDS } from "@/lib/zapier-sdk-tools";

describe("backgroundToolsConfig", () => {
  it("opts in every read-only Zapier tool + search_history, with a wait-timeout", () => {
    const cfg = backgroundToolsConfig();
    expect(cfg.waitTimeoutMs).toBe(30_000);
    // search_history (custom read) is opted in.
    expect(cfg.tools.search_history).toEqual({ enabled: true });
    // Every read-only Zapier tool id is opted in.
    for (const id of READ_ONLY_TOOL_IDS) {
      expect(cfg.tools[id]).toEqual({ enabled: true });
    }
    expect(READ_ONLY_TOOL_IDS.length).toBeGreaterThan(0);
  });

  it("excludes write/destructive tools (run-action, create-table-records)", () => {
    const cfg = backgroundToolsConfig();
    expect(cfg.tools["run-action"]).toBeUndefined();
    expect(cfg.tools["create-table-records"]).toBeUndefined();
  });
});
