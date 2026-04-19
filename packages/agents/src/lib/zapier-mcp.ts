import { MCPClient } from "@mastra/mcp";

/**
 * MCPClient that connects to the Zapier SDK's built-in MCP server via stdio.
 *
 * This replaces 13 custom tools with the SDK's native MCP tools:
 * - Actions: get-action, list-actions, run-action, get-input-fields-schema, etc.
 * - Apps: get-app, list-apps
 * - Connections: list-connections, find-first-connection, etc.
 * - Tables: full CRUD (create/read/update/delete tables, fields, records)
 * - HTTP: fetch, request (authenticated via Zapier Relay)
 *
 * The SDK uses credentials from either:
 * - CLI login: `npx zapier-sdk login` (dev, stored in ~/.zapier-sdk/config.json)
 * - Env var: ZAPIER_CREDENTIALS (production token)
 * - Client credentials: ZAPIER_CREDENTIALS_CLIENT_ID + ZAPIER_CREDENTIALS_CLIENT_SECRET
 */
export function createZapierMCPClient() {
  return new MCPClient({
    id: "zapier-sdk",
    servers: {
      zapier: {
        command: "npx",
        args: ["zapier-sdk", "mcp"],
      },
    },
    timeout: 120000, // Zapier API calls can be slow
  });
}

/**
 * Wrap MCP tools with toModelOutput to reduce context usage.
 *
 * MCP tool results can be very verbose (full API responses, nested objects).
 * toModelOutput transforms the raw result into a concise summary before
 * sending it back to the model, saving tokens and improving decisions.
 */
export function addModelOutputTransformers(
  tools: Record<string, any>
): Record<string, any> {
  const transformed: Record<string, any> = {};

  for (const [name, tool] of Object.entries(tools)) {
    transformed[name] = {
      ...tool,
      toModelOutput: createSummarizer(name),
    };
  }

  return transformed;
}

function createSummarizer(toolName: string) {
  return (output: unknown): unknown => {
    if (!output || typeof output !== "object") return output;

    const data = (output as any).data ?? output;
    const result = (output as any).result ?? data;

    // For list operations, summarize count + key fields
    if (Array.isArray(result)) {
      const items = result.slice(0, 20); // Cap at 20 items
      const summarized = items.map((item: any) => {
        if (typeof item !== "object" || !item) return item;
        // Keep only key identifying fields
        const { id, name, title, key, app, appKey, slug, status, type, actionType, ...rest } = item;
        const summary: Record<string, unknown> = {};
        if (id) summary.id = id;
        if (name) summary.name = name;
        if (title) summary.title = title;
        if (key) summary.key = key;
        if (app) summary.app = app;
        if (appKey) summary.appKey = appKey;
        if (slug) summary.slug = slug;
        if (status) summary.status = status;
        if (type) summary.type = type;
        if (actionType) summary.actionType = actionType;
        // For items with few extra fields, include them
        const extraKeys = Object.keys(rest);
        if (extraKeys.length <= 3) {
          Object.assign(summary, rest);
        } else {
          summary._extraFields = extraKeys.length;
        }
        return summary;
      });
      const response: Record<string, unknown> = {
        items: summarized,
        count: result.length,
      };
      if (result.length > 20) response.truncated = true;
      if ((output as any).nextCursor) response.nextCursor = (output as any).nextCursor;
      return response;
    }

    // For run-action results, keep the full result (it's the action output)
    if (toolName.includes("run-action")) return output;

    // For single-item responses, keep as-is but trim very long strings
    if (typeof result === "object" && result !== null) {
      return trimDeep(result, 500);
    }

    return output;
  };
}

/**
 * Recursively trim string values longer than maxLen to reduce token usage.
 */
function trimDeep(obj: any, maxLen: number): any {
  if (typeof obj === "string") {
    return obj.length > maxLen ? obj.slice(0, maxLen) + "..." : obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 30).map((v) => trimDeep(v, maxLen));
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = trimDeep(v, maxLen);
    }
    return result;
  }
  return obj;
}
