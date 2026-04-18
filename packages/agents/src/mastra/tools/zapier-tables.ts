import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSdkForUser } from "@/lib/zapier";

export const listTablesTool = createTool({
  id: "list_tables",
  description: "List all Zapier Tables the user has access to.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
  }),
  execute: async ({ userId }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.listTables();
    return { tables: data };
  },
});

export const getTableTool = createTool({
  id: "get_table",
  description: "Get details about a specific Zapier Table including its fields/columns.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    tableId: z.string().describe("The table ID"),
  }),
  execute: async ({ userId, tableId }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.getTable({ tableId });
    return { table: data };
  },
});

export const listTableRecordsTool = createTool({
  id: "list_table_records",
  description:
    "List records in a Zapier Table. Supports filtering and sorting.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    tableId: z.string().describe("The table ID"),
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional filter object to narrow results"),
    sort: z
      .string()
      .optional()
      .describe("Optional field key to sort by"),
    sortDirection: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort direction (default: asc)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of records to return"),
    offset: z
      .number()
      .optional()
      .describe("Number of records to skip (for pagination)"),
  }),
  execute: async ({ userId, tableId, filter, sort, sortDirection, limit, offset }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.listTableRecords({
      tableId,
      ...(filter ? { filter } : {}),
      ...(sort ? { sort } : {}),
      ...(sortDirection ? { sortDirection } : {}),
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
    });
    return { records: data };
  },
});

export const createTableRecordTool = createTool({
  id: "create_table_record",
  description: "Create a new record in a Zapier Table.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    tableId: z.string().describe("The table ID"),
    fields: z
      .record(z.string(), z.unknown())
      .describe("The field values for the new record"),
  }),
  execute: async ({ userId, tableId, fields }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.createTableRecord({ tableId, fields });
    return { record: data };
  },
});

export const updateTableRecordTool = createTool({
  id: "update_table_record",
  description: "Update an existing record in a Zapier Table.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    tableId: z.string().describe("The table ID"),
    recordId: z.string().describe("The record ID to update"),
    fields: z
      .record(z.string(), z.unknown())
      .describe("The field values to update"),
  }),
  execute: async ({ userId, tableId, recordId, fields }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.updateTableRecord({ tableId, recordId, fields });
    return { record: data };
  },
});

export const searchTableRecordsTool = createTool({
  id: "search_table_records",
  description:
    "Search records in a Zapier Table using field-level filters.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    tableId: z.string().describe("The table ID"),
    searchField: z.string().describe("The field key to search on"),
    searchValue: z.string().describe("The value to search for"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of records to return"),
  }),
  execute: async ({ userId, tableId, searchField, searchValue, limit }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.listTableRecords({
      tableId,
      filter: { [searchField]: searchValue },
      ...(limit ? { limit } : {}),
    });
    return { records: data };
  },
});
