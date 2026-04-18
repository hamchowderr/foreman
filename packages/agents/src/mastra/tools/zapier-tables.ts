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
    table: z.string().describe("The table ID"),
  }),
  execute: async ({ userId, table }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.getTable({ table });
    return { table: data };
  },
});

const filterSchema = z.object({
  fieldKey: z.string().describe("The field key to filter on"),
  operator: z
    .enum([
      "search", "in", "exact", "contains", "different",
      "icontains", "gte", "gt", "lt", "lte", "range",
      "isnull", "startswith", "is_within",
    ])
    .describe("The filter operator"),
  value: z.unknown().optional().describe("The filter value"),
});

export const listTableRecordsTool = createTool({
  id: "list_table_records",
  description:
    "List records in a Zapier Table. Supports filtering and sorting.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    table: z.string().describe("The table ID"),
    filters: z
      .array(filterSchema)
      .optional()
      .describe("Optional array of filter conditions"),
    sort: z
      .object({
        fieldKey: z.string().describe("The field key to sort by"),
        direction: z
          .enum(["asc", "desc"])
          .describe("Sort direction: 'asc' or 'desc'"),
      })
      .optional()
      .describe("Optional sort condition"),
  }),
  execute: async ({ userId, table, filters, sort }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.listTableRecords({
      table,
      keyMode: "names",
      ...(filters ? { filters } : {}),
      ...(sort ? { sort } : {}),
    });
    return { records: data };
  },
});

export const createTableRecordTool = createTool({
  id: "create_table_record",
  description: "Create a new record in a Zapier Table.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    table: z.string().describe("The table ID"),
    data: z
      .record(z.string(), z.unknown())
      .describe("The field values for the new record, keyed by field name"),
  }),
  execute: async ({ userId, table, data }) => {
    const sdk = await getSdkForUser(userId);
    const result = await sdk.createTableRecords({
      table,
      keyMode: "names",
      records: [{ data }],
    });
    return { record: result.data?.[0] ?? result.data };
  },
});

export const updateTableRecordTool = createTool({
  id: "update_table_record",
  description: "Update an existing record in a Zapier Table.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    table: z.string().describe("The table ID"),
    recordId: z.string().describe("The record ID to update"),
    data: z
      .record(z.string(), z.unknown())
      .describe("The field values to update, keyed by field name"),
  }),
  execute: async ({ userId, table, recordId, data }) => {
    const sdk = await getSdkForUser(userId);
    const result = await sdk.updateTableRecords({
      table,
      keyMode: "names",
      records: [{ id: recordId, data }],
    });
    return { record: result.data?.[0] ?? result.data };
  },
});

export const searchTableRecordsTool = createTool({
  id: "search_table_records",
  description:
    "Search records in a Zapier Table by matching a field value.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID"),
    table: z.string().describe("The table ID"),
    fieldKey: z.string().describe("The field key to search on"),
    value: z.string().describe("The value to search for"),
  }),
  execute: async ({ userId, table, fieldKey, value }) => {
    const sdk = await getSdkForUser(userId);
    const { data } = await sdk.listTableRecords({
      table,
      keyMode: "names",
      filters: [{ fieldKey, operator: "search", value }],
    });
    return { records: data };
  },
});
