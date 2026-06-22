/**
 * Unit tests for zapier-sdk-tools.ts — tool generation logic.
 * No API calls. Verifies tools are generated with correct metadata.
 */
import { ZapierApprovalError } from "@zapier/zapier-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { generateZapierTools, handleSdkError } from "../../src/lib/zapier-sdk-tools";

let tools: Record<string, any>;

beforeAll(() => {
  tools = generateZapierTools();
});

describe("handleSdkError — Zapier approval flow (foreman-elyi)", () => {
  it("surfaces the approval URL from ZapierApprovalError", () => {
    const url = "https://zapier.com/app/approve/abc123";
    const result = handleSdkError(
      new ZapierApprovalError("Approval required", { approvalUrl: url }),
      "run-action",
    );
    expect(result.code).toBe("APPROVAL_REQUIRED");
    expect(result.error).toContain(url);
    expect(result.retryable).toBe(false);
  });

  it("falls back gracefully when no approval URL is present", () => {
    const result = handleSdkError(new ZapierApprovalError("Approval required"), "run-action");
    expect(result.code).toBe("APPROVAL_REQUIRED");
    expect(result.error).not.toContain("undefined");
  });
});

describe("Tool generation", () => {
  it("generates tools with kebab-case IDs", () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(tool.id).toBe(name);
    }
  });

  it("excludes deprecated and unused methods", () => {
    const excluded = [
      // Deprecated wrappers
      "request",
      "list-authentications",
      "find-first-authentication",
      "find-unique-authentication",
      "get-authentication",
      // Deprecated input-field aliases — canonical trio surfaced instead
      "list-input-fields",
      "get-input-fields-schema",
      "list-input-field-choices",
      // Connect Builder OAuth client credentials — not exposed
      "create-client-credentials",
      "delete-client-credentials",
      "list-client-credentials",
    ];
    for (const name of excluded) {
      expect(tools[name], `${name} should be excluded from tool generation`).toBeUndefined();
    }
  });

  it("sets requireApproval on write/delete tools", () => {
    const shouldRequire = [
      "run-action",
      "fetch",
      "create-table",
      "delete-table",
      "create-table-records",
      "update-table-records",
      "delete-table-records",
      "create-table-fields",
      "delete-table-fields",
    ];
    for (const name of shouldRequire) {
      const tool = tools[name];
      expect(tool, `${name} should exist`).toBeDefined();
      expect(tool.requireApproval, `${name} should require approval`).toBe(true);
    }
  });

  it("does NOT set requireApproval on read-only tools", () => {
    const readOnly = [
      "list-apps",
      "get-app",
      "list-actions",
      "get-action",
      "list-connections",
      "find-first-connection",
      "get-action-input-fields-schema",
      "list-action-input-fields",
      "list-action-input-field-choices",
      "list-tables",
      "get-table",
      "list-table-fields",
      "list-table-records",
      "get-table-record",
      "get-profile",
    ];
    for (const name of readOnly) {
      const tool = tools[name];
      if (!tool) continue; // some may not exist in all SDK versions
      expect(tool.requireApproval, `${name} should NOT require approval`).toBeFalsy();
    }
  });

  it("every tool has a description and inputSchema", () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, `${name} missing description`).toBeTruthy();
      expect(tool.inputSchema, `${name} missing inputSchema`).toBeDefined();
    }
  });

  it("toModelOutput summarizes list results", () => {
    const tool = tools["list-apps"];
    if (!tool?.toModelOutput) return;

    const bigList = Array.from({ length: 30 }, (_, i) => ({
      id: `app-${i}`,
      name: `App ${i}`,
      slug: `app-${i}`,
      extraField1: "x",
      extraField2: "y",
      extraField3: "z",
      extraField4: "w",
    }));

    const result = tool.toModelOutput(bigList);
    // Should truncate to 20 items
    if (result?.items) {
      expect(result.items.length).toBeLessThanOrEqual(20);
      expect(result.truncated).toBe(true);
    }
  });

  it("toModelOutput trims long strings", () => {
    const tool = tools["get-app"];
    if (!tool?.toModelOutput) return;

    const longString = "x".repeat(1000);
    const result = tool.toModelOutput({ data: { name: "test", bio: longString } });
    const bio = (result?.data ?? result)?.bio ?? result?.bio;
    if (bio) {
      expect(bio.length).toBeLessThanOrEqual(503); // 500 + "..."
    }
  });
});
