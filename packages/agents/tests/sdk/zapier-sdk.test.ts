/**
 * Zapier SDK Integration Tests
 *
 * These tests hit the REAL Zapier API using your CLI login credentials.
 * They verify the SDK tools actually work end-to-end — not mocked.
 *
 * Prerequisites:
 *   npx @zapier/zapier-sdk-cli login
 *
 * Run:
 *   npm run test:sdk              (from packages/agents)
 *   npm run test:sdk:read         (read-only tests only)
 *   npm run test:sdk:write        (write tests — creates/deletes a real table)
 *
 * SDK parameter reference (from registry inspection):
 *   listActions:          app, actionType, pageSize, maxItems, cursor
 *   getAction:            app, actionType, action
 *   getApp:               app
 *   getInputFieldsSchema: app, actionType, action, connection, connectionId, authenticationId, inputs
 *   listInputFieldChoices: app, actionType, action, inputField, connection, connectionId, authenticationId, inputs
 *   findFirstConnection:  search, title, owner, app, appKey, account, accountId, includeShared, isExpired, expired
 *   runAction:            app, actionType, action, connection, connectionId, authenticationId, inputs, timeoutMs
 *   createTable:          name, description
 *   deleteTable:          table
 *   createTableFields:    table, fields
 *   createTableRecords:   table, records, keyMode
 *   listTableRecords:     table, filters, sort, pageSize, maxItems, cursor, keyMode
 *   getTable:             table
 *   fetch (positional):   url, init
 *
 * Connection object shape:
 *   { id, app_key, app_version, title, implementation_id, is_expired, ... }
 *   NOTE: Field is `app_key` (snake_case), NOT `appKey` (camelCase)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateZapierTools } from "../../src/lib/zapier-sdk-tools";

// Longer timeout — real API calls
const TIMEOUT = 30_000;

let tools: Record<string, any>;

beforeAll(() => {
  tools = generateZapierTools();
}, TIMEOUT);

// ─── Helpers ───────────────────────────────────────────────────────────────

async function exec(toolName: string, input: Record<string, unknown> = {}) {
  const tool = tools[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not found. Available: ${Object.keys(tools).join(", ")}`);
  const fn = tool.execute ?? tool;
  if (typeof fn !== "function") {
    throw new Error(`Tool "${toolName}" has no execute function`);
  }
  return fn(input);
}

/** Dump a tool's input schema shape for debugging parameter names. */
function dumpSchema(toolName: string) {
  const tool = tools[toolName];
  if (!tool) return [];
  const schema = tool.inputSchema ?? tool.schema;
  if (schema?._zod?.def?.shape) {
    const keys = Object.keys(schema._zod.def.shape);
    console.log(`  [schema:${toolName}] params: ${keys.join(", ")}`);
    return keys;
  }
  if (schema?.shape) {
    const keys = Object.keys(schema.shape);
    console.log(`  [schema:${toolName}] params: ${keys.join(", ")}`);
    return keys;
  }
  console.log(`  [schema:${toolName}] could not extract shape`);
  return [];
}

function log(label: string, data: unknown) {
  const preview =
    typeof data === "string"
      ? data.slice(0, 200)
      : JSON.stringify(data, null, 2)?.slice(0, 500);
  console.log(`  [${label}] ${preview}`);
}

/** Assert result is not an SDK validation error. */
function assertNotValidationError(result: any, context: string) {
  if (result?.error === true && result?.validationErrors) {
    throw new Error(
      `${context}: SDK validation failed — wrong param names.\n${result.message}`,
    );
  }
}

// ─── READ TESTS ────────────────────────────────────────────────────────────

describe("SDK Read Tests", () => {
  it("generates tools from SDK registry", () => {
    const names = Object.keys(tools);
    console.log(`  Generated ${names.length} tools: ${names.join(", ")}`);
    expect(names.length).toBeGreaterThanOrEqual(20);
    expect(tools["list-connections"]).toBeDefined();
    expect(tools["list-apps"]).toBeDefined();
    expect(tools["list-actions"]).toBeDefined();
    expect(tools["run-action"]).toBeDefined();
  });

  it(
    "list-connections — returns connected apps",
    async () => {
      const result = await exec("list-connections");
      log("list-connections", result);
      assertNotValidationError(result, "list-connections");
      const items = result.items;
      expect(Array.isArray(items)).toBe(true);
      console.log(`  Found ${items.length} connected app(s)`);
      if (items.length > 0) {
        // Connection objects use `app_key` (snake_case)
        console.log(
          `  Apps: ${items.map((c: any) => c.app_key ?? c.title).join(", ")}`,
        );
      }
    },
    TIMEOUT,
  );

  it(
    "list-apps — returns available apps from Zapier catalog",
    async () => {
      const result = await exec("list-apps");
      log("list-apps", result);
      assertNotValidationError(result, "list-apps");
      const items = result.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      const hasMore = result?.nextCursor !== undefined && result?.nextCursor !== null;
      console.log(
        `  Found ${items.length} app(s)${hasMore ? ` (more available, cursor: ${result.nextCursor})` : " (complete)"}`,
      );
    },
    TIMEOUT,
  );

  it(
    "get-profile — returns current user profile",
    async () => {
      const profile = await exec("get-profile");
      log("get-profile", profile);
      assertNotValidationError(profile, "get-profile");
      expect(profile).toBeDefined();
      console.log(
        `  User: ${profile.full_name ?? profile.email ?? "unknown"}`,
      );
    },
    TIMEOUT,
  );

  // Store first connected app's key for downstream tests.
  // Connection objects return `app_key` (snake_case), e.g. "GoogleMailV2CLIAPI".
  // SDK tool params use `app` for most tools but `appKey` for findFirstConnection.
  let firstApp: string | undefined;

  it(
    "find-first-connection — returns first connected app",
    async () => {
      const connections = await exec("list-connections");
      const items = connections.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no connections found");
        return;
      }
      // Connection objects use `app_key` (snake_case)
      firstApp = items[0].app_key;
      expect(firstApp).toBeDefined();
      console.log(`  First connected app: ${firstApp}`);

      // findFirstConnection accepts `appKey` param
      const result = await exec("find-first-connection", {
        appKey: firstApp,
      });
      log("find-first-connection", result);
      assertNotValidationError(result, "find-first-connection");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "list-actions — lists actions for a connected app",
    async () => {
      if (!firstApp) {
        console.log("  SKIP: no connected apps to query actions for");
        return;
      }
      // listActions uses `app` param (not `appKey`)
      const result = await exec("list-actions", { app: firstApp });
      log("list-actions", result);
      assertNotValidationError(result, "list-actions");
      const items = result.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      console.log(
        `  ${firstApp} has ${items.length} action(s): ${items
          .slice(0, 5)
          .map((a: any) => a.key ?? a.name)
          .join(", ")}${items.length > 5 ? "..." : ""}`,
      );
    },
    TIMEOUT,
  );

  it(
    "get-action — gets details for a specific action",
    async () => {
      if (!firstApp) {
        console.log("  SKIP: no connected app");
        return;
      }
      const actions = await exec("list-actions", { app: firstApp });
      assertNotValidationError(actions, "list-actions (for get-action)");
      const items = actions.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no actions found");
        return;
      }
      const actionKey = items[0].key ?? items[0].id;
      const actionType = items[0].action_type ?? items[0].actionType;
      console.log(`  Getting action: ${actionKey} (type: ${actionType})`);
      // getAction uses: app, actionType, action
      const result = await exec("get-action", {
        app: firstApp,
        actionType: actionType ?? "read",
        action: actionKey,
      });
      log("get-action", result);
      assertNotValidationError(result, "get-action");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "get-input-fields-schema — gets input schema for an action",
    async () => {
      if (!firstApp) {
        console.log("  SKIP: no connected app");
        return;
      }
      const actions = await exec("list-actions", { app: firstApp });
      assertNotValidationError(actions, "list-actions (for schema)");
      const items = actions.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no actions found");
        return;
      }
      const actionKey = items[0].key ?? items[0].id;
      const actionType = items[0].action_type ?? items[0].actionType;
      // getInputFieldsSchema uses: app, actionType, action
      const result = await exec("get-input-fields-schema", {
        app: firstApp,
        actionType: actionType ?? "read",
        action: actionKey,
      });
      log("get-input-fields-schema", result);
      assertNotValidationError(result, "get-input-fields-schema");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "list-tables — lists Zapier Tables",
    async () => {
      const result = await exec("list-tables");
      log("list-tables", result);
      assertNotValidationError(result, "list-tables");
      const items = result.items;
      console.log(
        `  Found ${Array.isArray(items) ? items.length : 0} table(s)`,
      );
    },
    TIMEOUT,
  );

  it(
    "list-client-credentials — lists OAuth credentials",
    async () => {
      const result = await exec("list-client-credentials");
      log("list-client-credentials", result);
      assertNotValidationError(result, "list-client-credentials");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "get-app — gets details for a specific app",
    async () => {
      // Use a known connected app, not a random catalog app
      const app = firstApp ?? "GoogleMailV2CLIAPI";
      console.log(`  Looking up app: ${app}`);
      // getApp uses `app` param
      const result = await exec("get-app", { app });
      log("get-app", result);
      assertNotValidationError(result, "get-app");
      expect(result).toBeDefined();
      // Should have app metadata, not an error
      expect(result.key ?? result.slug ?? result.title).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "list-input-field-choices — gets enum options for an action field",
    async () => {
      if (!firstApp) {
        console.log("  SKIP: no connected app");
        return;
      }
      const actions = await exec("list-actions", { app: firstApp });
      assertNotValidationError(actions, "list-actions (for choices)");
      const items = actions.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no actions found");
        return;
      }
      const actionKey = items[0].key ?? items[0].id;
      const actionType = items[0].action_type ?? items[0].actionType ?? "read";

      // Get schema to find a field name
      const schema = await exec("get-input-fields-schema", {
        app: firstApp,
        actionType,
        action: actionKey,
      });
      assertNotValidationError(schema, "get-input-fields-schema (for choices)");
      // JSON Schema response: { type: "object", properties: { fieldKey: {...} }, ... }
      const fieldKeys = Object.keys(schema.properties ?? {});
      if (fieldKeys.length === 0) {
        console.log("  SKIP: no fields in schema");
        return;
      }
      const fieldKey = fieldKeys[0];
      console.log(`  Fetching choices for field: ${fieldKey}`);
      // listInputFieldChoices uses: app, actionType, action, inputField
      const result = await exec("list-input-field-choices", {
        app: firstApp,
        actionType,
        action: actionKey,
        inputField: fieldKey,
      });
      log("list-input-field-choices", result);
      assertNotValidationError(result, "list-input-field-choices");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "get-table — gets details for a specific table",
    async () => {
      const tables = await exec("list-tables");
      assertNotValidationError(tables, "list-tables (for get-table)");
      const items = tables.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no tables found");
        return;
      }
      const tableId = items[0].id;
      console.log(`  Looking up table: ${tableId}`);
      // getTable uses `table` param
      const result = await exec("get-table", { table: tableId });
      log("get-table", result);
      assertNotValidationError(result, "get-table");
      expect(result).toBeDefined();
    },
    TIMEOUT,
  );
});

// ─── ERROR HANDLING TESTS ─────────────────────────────────────────────────

describe("SDK Error Handling", () => {
  it(
    "returns structured error for invalid app (SDK error, not validation)",
    async () => {
      // Use correct param `app` to get past validation, trigger real SDK error
      const result = await exec("list-actions", {
        app: "definitely-not-a-real-app-xyz",
      });
      log("invalid-app", result);
      expect(result).toBeDefined();
      // handleSdkError returns { error, code, retryable }
      expect(result.error).toBeDefined();
      expect(result.code).toBeDefined();
      expect(typeof result.retryable).toBe("boolean");
      console.log(
        `  Error code: ${result.code}, retryable: ${result.retryable}`,
      );
    },
    TIMEOUT,
  );

  it(
    "returns validation error for wrong param name",
    async () => {
      // Intentionally wrong: `appKey` instead of `app`
      const result = await exec("list-actions", { appKey: "gmail" });
      log("wrong-param", result);
      // SDK validation layer returns { error: true, message, validationErrors }
      expect(result.error).toBe(true);
      expect(result.message).toContain("validation failed");
      expect(result.validationErrors).toBeDefined();
      console.log(`  Validation caught: ${result.message?.slice(0, 100)}`);
    },
    TIMEOUT,
  );

  it(
    "returns structured error for invalid action key",
    async () => {
      const connections = await exec("list-connections");
      const items = connections.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.log("  SKIP: no connections");
        return;
      }
      const appKey = items[0].app_key;
      // getAction requires: app, actionType, action
      const result = await exec("get-action", {
        app: appKey,
        actionType: "read",
        action: "fake-action-that-does-not-exist",
      });
      log("invalid-action", result);
      expect(result).toBeDefined();
      const hasError = result.error || result.code;
      expect(hasError).toBeTruthy();
      console.log(`  Error: ${result.code ?? "sdk"} — ${result.error ?? result.message}`);
    },
    TIMEOUT,
  );

  it("schema dump — logs parameter names for key tools", () => {
    const keyTools = [
      "list-actions",
      "get-action",
      "get-app",
      "get-input-fields-schema",
      "list-input-field-choices",
      "run-action",
      "fetch",
      "find-first-connection",
      "create-table",
      "delete-table",
      "create-table-records",
      "create-table-fields",
      "list-table-records",
      "get-table",
    ];
    for (const name of keyTools) {
      dumpSchema(name);
    }
  });
});

// ─── WRITE TESTS ───────────────────────────────────────────────────────────

describe("SDK Write Tests", () => {
  const TEST_TABLE_NAME = `foreman-test-${Date.now()}`;
  let createdTableId: string | undefined;

  afterAll(async () => {
    if (createdTableId) {
      try {
        console.log(`  Cleaning up test table: ${TEST_TABLE_NAME} (${createdTableId})`);
        await exec("delete-table", { table: createdTableId });
        console.log("  Cleanup complete");
      } catch (err) {
        console.error(`  Cleanup failed: ${err}`);
      }
    }
  }, TIMEOUT);

  it(
    "create-table → add-fields → create-records → list-records → delete-table",
    async () => {
      // 1. Create table
      console.log(`  Creating table: ${TEST_TABLE_NAME}`);
      const createResult = await exec("create-table", { name: TEST_TABLE_NAME });
      log("create-table", createResult);
      assertNotValidationError(createResult, "create-table");

      createdTableId = createResult?.data?.id ?? createResult?.id;
      expect(createdTableId).toBeDefined();
      console.log(`  Table created: ${createdTableId}`);

      // 2. Add fields
      console.log("  Adding fields...");
      const fieldsResult = await exec("create-table-fields", {
        table: createdTableId,
        fields: [
          { name: "task", type: "text" },
          { name: "priority", type: "number" },
        ],
      });
      log("create-table-fields", fieldsResult);
      assertNotValidationError(fieldsResult, "create-table-fields");

      // 3. List fields to verify
      const listFields = await exec("list-table-fields", { table: createdTableId });
      assertNotValidationError(listFields, "list-table-fields");
      const fields = listFields?.data ?? listFields;
      expect(Array.isArray(fields)).toBe(true);
      console.log(`  Table has ${fields.length} field(s)`);

      // 4. Create records
      console.log("  Creating records...");
      const recordsResult = await exec("create-table-records", {
        table: createdTableId,
        records: [
          { data: { task: "Test task 1", priority: 1 } },
          { data: { task: "Test task 2", priority: 2 } },
          { data: { task: "Test task 3", priority: 3 } },
        ],
      });
      log("create-table-records", recordsResult);
      assertNotValidationError(recordsResult, "create-table-records");

      // 5. List records to verify
      const listRecords = await exec("list-table-records", { table: createdTableId });
      assertNotValidationError(listRecords, "list-table-records");
      const records = listRecords?.data ?? listRecords;
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThanOrEqual(3);
      console.log(`  Found ${records.length} record(s)`);

      // 6. Delete table
      console.log(`  Deleting table: ${createdTableId}`);
      const deleteResult = await exec("delete-table", { table: createdTableId });
      log("delete-table", deleteResult);
      assertNotValidationError(deleteResult, "delete-table");
      createdTableId = undefined;
      console.log("  Full write cycle complete");
    },
    60_000,
  );
});
