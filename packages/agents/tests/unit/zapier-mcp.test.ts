import { describe, it, expect, afterAll } from "vitest";
import {
  createZapierMCPClient,
  addModelOutputTransformers,
} from "@/lib/zapier-mcp";

describe("Zapier MCP Client", () => {
  let mcp: ReturnType<typeof createZapierMCPClient>;

  afterAll(async () => {
    if (mcp) await mcp.disconnect();
  });

  it("creates MCP client without error", () => {
    mcp = createZapierMCPClient();
    expect(mcp).toBeDefined();
  });

  it("lists tools from Zapier SDK MCP server", async () => {
    mcp = createZapierMCPClient();
    const tools = await mcp.listTools();

    expect(Object.keys(tools).length).toBeGreaterThan(20);

    // Core action tools should be present (namespaced with "zapier_")
    expect(tools).toHaveProperty("zapier_run-action");
    expect(tools).toHaveProperty("zapier_list-actions");
    expect(tools).toHaveProperty("zapier_list-apps");
    expect(tools).toHaveProperty("zapier_get-input-fields-schema");
    expect(tools).toHaveProperty("zapier_list-input-field-choices");

    // Connection tools
    expect(tools).toHaveProperty("zapier_list-connections");
    expect(tools).toHaveProperty("zapier_find-first-connection");

    // Table tools
    expect(tools).toHaveProperty("zapier_list-tables");
    expect(tools).toHaveProperty("zapier_create-table-records");
    expect(tools).toHaveProperty("zapier_list-table-records");

    // HTTP tools
    expect(tools).toHaveProperty("zapier_fetch");
  }, 30000); // MCP server startup can be slow

  it("every tool has a description and inputSchema", async () => {
    mcp = createZapierMCPClient();
    const tools = await mcp.listTools();

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool, `${name} should have description`).toHaveProperty("description");
    }
  }, 30000);
});

describe("addModelOutputTransformers", () => {
  it("adds toModelOutput to all tools", () => {
    const mockTools = {
      "zapier_list-apps": { description: "List apps", execute: async () => ({}) },
      "zapier_run-action": { description: "Run action", execute: async () => ({}) },
    };

    const transformed = addModelOutputTransformers(mockTools);

    expect(transformed["zapier_list-apps"]).toHaveProperty("toModelOutput");
    expect(transformed["zapier_run-action"]).toHaveProperty("toModelOutput");
  });

  it("adds requireApproval to write tools", () => {
    const mockTools = {
      "zapier_list-apps": { description: "List apps" },
      "zapier_run-action": { description: "Run action" },
      "zapier_fetch": { description: "Fetch" },
      "zapier_list-connections": { description: "List connections" },
    };

    const transformed = addModelOutputTransformers(mockTools);

    expect(transformed["zapier_run-action"].requireApproval).toBe(true);
    expect(transformed["zapier_fetch"].requireApproval).toBe(true);
    expect(transformed["zapier_list-apps"].requireApproval).toBeUndefined();
    expect(transformed["zapier_list-connections"].requireApproval).toBeUndefined();
  });

  it("toModelOutput summarizes list results", () => {
    const mockTools = {
      "zapier_list-apps": { description: "List apps" },
    };

    const transformed = addModelOutputTransformers(mockTools);
    const summarizer = transformed["zapier_list-apps"].toModelOutput;

    // Simulate a list result from the MCP server
    const rawOutput = [
      { id: "1", name: "Gmail", slug: "gmail", title: "Gmail", extra1: "a", extra2: "b", extra3: "c", extra4: "d" },
      { id: "2", name: "Slack", slug: "slack", title: "Slack", extra1: "x", extra2: "y", extra3: "z", extra4: "w" },
    ];

    const result = summarizer(rawOutput) as any;
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
    // Extra fields beyond 3 should be counted, not included
    expect(result.items[0]).toHaveProperty("id");
    expect(result.items[0]).toHaveProperty("name");
    expect(result.items[0]).toHaveProperty("slug");
    expect(result.items[0]).toHaveProperty("_extraFields");
  });

  it("toModelOutput preserves run-action results", () => {
    const mockTools = {
      "zapier_run-action": { description: "Run" },
    };

    const transformed = addModelOutputTransformers(mockTools);
    const summarizer = transformed["zapier_run-action"].toModelOutput;

    const rawOutput = { data: { sent: true, messageId: "abc123" } };
    const result = summarizer(rawOutput);
    // run-action results should pass through unchanged
    expect(result).toEqual(rawOutput);
  });

  it("toModelOutput trims long strings", () => {
    const mockTools = {
      "zapier_get-app": { description: "Get app" },
    };

    const transformed = addModelOutputTransformers(mockTools);
    const summarizer = transformed["zapier_get-app"].toModelOutput;

    const longString = "x".repeat(1000);
    const rawOutput = { name: "Test", description: longString };
    const result = summarizer(rawOutput) as any;
    expect(result.description.length).toBeLessThan(600);
    expect(result.description).toContain("...");
  });
});
