import { generateZapierTools } from "./zapier-sdk-tools";

export interface CatalogTool {
  id: string;
  description: string;
  read_only: boolean;
  requires_approval: boolean;
  category: "zapier" | "custom";
}

/**
 * Read-only tools — mirrored from zapier-sdk-tools.ts READ_ONLY set, using
 * kebab-case tool ids.
 */
const READ_ONLY_IDS = new Set([
  "list-apps",
  "get-app",
  "list-actions",
  "get-action",
  "list-connections",
  "find-first-connection",
  "find-unique-connection",
  "get-connection",
  "get-input-fields-schema",
  "list-input-fields",
  "list-input-field-choices",
  "list-tables",
  "get-table",
  "list-table-fields",
  "list-table-records",
  "get-table-record",
  "list-client-credentials",
  "get-profile",
]);

const APPROVAL_REQUIRED_IDS = new Set([
  "run-action",
  "fetch",
  "create-table",
  "delete-table",
  "create-table-records",
  "update-table-records",
  "delete-table-records",
  "create-table-fields",
  "delete-table-fields",
]);

// In-process cache — tool registry is static across requests.
let _cached: CatalogTool[] | undefined;

export async function getToolCatalog(): Promise<CatalogTool[]> {
  if (_cached) return _cached;

  const catalog: CatalogTool[] = [];

  // Custom Foreman tools (always available to stored agents).
  catalog.push(
    {
      id: "search_history",
      description: "Semantic search over prior action history",
      read_only: true,
      requires_approval: false,
      category: "custom",
    },
    {
      id: "fork_conversation",
      description: "Spawn a forked sub-conversation for parallel exploration",
      read_only: false,
      requires_approval: false,
      category: "custom",
    },
    {
      id: "connect_zapier",
      description: "Generate a Zapier OAuth connect URL for an app",
      read_only: false,
      requires_approval: false,
      category: "custom",
    }
  );

  // Zapier SDK tools. generateZapierTools() reads from the SDK registry and
  // doesn't require live credentials to enumerate the catalog — execution would
  // need them, but listing ids/descriptions does not.
  try {
    const tools = generateZapierTools();
    for (const [id, tool] of Object.entries(tools)) {
      catalog.push({
        id,
        description: (tool as any).description ?? id,
        read_only: READ_ONLY_IDS.has(id),
        requires_approval: APPROVAL_REQUIRED_IDS.has(id),
        category: "zapier",
      });
    }
  } catch (err) {
    // Zapier SDK unavailable in some environments (e.g., no credentials at all).
    // Fall back to just custom tools so the picker still works.
    console.warn(
      "tool-catalog: Zapier SDK enumeration failed, returning custom tools only",
      err instanceof Error ? err.message : err
    );
  }

  catalog.sort((a, b) => {
    if (a.category !== b.category) return a.category === "custom" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  _cached = catalog;
  return catalog;
}
