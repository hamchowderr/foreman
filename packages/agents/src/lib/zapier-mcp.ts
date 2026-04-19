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
