import path from "node:path";
import { Workspace, type WorkspaceFilesystem } from "@mastra/core/workspace";
import { resolveActiveWorkspace } from "../../lib/identity";
import {
  getKnowledgeVector,
  knowledgeEmbedder,
  knowledgeIndexName,
} from "../../lib/knowledge/vector";
import {
  resolveWorkspaceFilesystem as resolveFsProvider,
  resolveSandbox,
} from "../../lib/providers/sandbox";
import { resolveRequestUserId } from "../../lib/request-user-context";

/**
 * Foreman's agent workspace — a per-tenant LocalFilesystem + LocalSandbox for
 * file ops and command execution, plus a per-tenant semantic KNOWLEDGE index
 * (foreman-aqjx). Scoped per tenant (foreman-jgme): each workspace_id gets its
 * own `./data/workspace/<workspace_id>` directory and its own
 * `knowledge_<workspace_id>` vector index.
 *
 * The whole Workspace is built PER REQUEST via `buildForemanWorkspace` (an Agent
 * workspace resolver) rather than a single static instance, because the search
 * index name must vary by tenant — one physical index per workspace IS the
 * tenant isolation boundary for search (see lib/knowledge/vector.ts for why a
 * shared index + metadata filter is unsafe with the built-in search tool).
 * Construction is cheap: the vector store and embedder are shared singletons.
 *
 * Where workspace_id comes from (in priority order):
 *  1. `RequestContext.workspaceId` — the web /chat route already resolves it
 *     (mastra/index.ts), so no extra DB hit on that path.
 *  2. The acting user id, back-resolved to their active workspace. That id
 *     comes from `resolveRequestUserId`, which reads `RequestContext.userId`
 *     first and the AsyncLocalStorage second — so this covers both a native
 *     Mastra channel handler (which stamps the RequestContext) and the current
 *     custom bots (which wrap the call in the ALS), without editing either.
 *  3. Fallback to a shared `_shared` dir/index when neither is present (e.g. the
 *     proposals approve/decline path, which executes Zapier actions and does not
 *     touch the workspace filesystem).
 */
const WORKSPACE_PATH = process.env.FOREMAN_WORKSPACE_PATH ?? "./data/workspace";
const SHARED_DIR = "_shared";

/** Defensive against path traversal — workspace ids are UUIDs in practice. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * The logical tenant key for the current request: a sanitized workspace_id, or
 * the shared fallback. Scopes BOTH the filesystem directory and the knowledge
 * index name so a workspace's files and their embeddings line up 1:1.
 */
export async function resolveWorkspaceTenantKey(requestContext?: {
  get(key: string): unknown;
}): Promise<string> {
  let wsId = (requestContext?.get("workspaceId") as string | undefined) ?? undefined;
  if (!wsId) {
    const userId = resolveRequestUserId(requestContext);
    if (userId) {
      wsId = (await resolveActiveWorkspace(userId).catch(() => null)) ?? undefined;
    }
  }
  return wsId ? sanitizeId(wsId) : SHARED_DIR;
}

/** The per-tenant base directory for the current request. */
async function resolveWorkspaceDir(requestContext?: {
  get(key: string): unknown;
}): Promise<string> {
  return path.join(WORKSPACE_PATH, await resolveWorkspaceTenantKey(requestContext));
}

/**
 * Resolve the per-tenant Workspace filesystem for the current request. Exported
 * for the non-agent read/write paths (documents route, save_document, public
 * document shares) that need file access without building a whole Workspace.
 */
export async function resolveWorkspaceFilesystem(requestContext?: {
  get(key: string): unknown;
}): Promise<WorkspaceFilesystem> {
  return resolveFsProvider(await resolveWorkspaceDir(requestContext));
}

/**
 * Build the foreman agent's Workspace for one request. Attached to the agent as
 * `workspace: buildForemanWorkspace`.
 *
 * Search is VECTOR-ONLY (`bm25` omitted): the workspace is rebuilt per request,
 * so an in-memory BM25 index would always be empty, while vector results live in
 * the persistent PgVector index. The auto-injected `mastra_workspace_index` tool
 * is disabled — indexing happens server-side on save (save_document), keeping the
 * index deterministic and preventing the LLM from polluting it.
 */
export async function buildForemanWorkspace({
  requestContext,
}: {
  requestContext?: { get(key: string): unknown };
}): Promise<Workspace> {
  const tenantKey = await resolveWorkspaceTenantKey(requestContext);
  const dir = path.join(WORKSPACE_PATH, tenantKey);
  return new Workspace({
    id: `foreman-workspace-${tenantKey}`,
    name: "Foreman Workspace",
    filesystem: resolveFsProvider(dir),
    sandbox: resolveSandbox({ workingDirectory: dir, tenantKey }),
    vectorStore: getKnowledgeVector(),
    embedder: knowledgeEmbedder,
    searchIndexName: knowledgeIndexName(tenantKey),
    tools: {
      mastra_workspace_index: { enabled: false },
      mastra_workspace_write_file: { requireApproval: true },
      mastra_workspace_edit_file: { requireApproval: true },
      mastra_workspace_delete: { requireApproval: true },
      mastra_workspace_execute_command: { requireApproval: true },
    },
  });
}

/**
 * A search-capable Workspace pointed at one tenant's knowledge index, keyed by
 * `tenantKey` directly (no RequestContext). A Workspace requires a
 * filesystem/sandbox/skills, so it gets the tenant's filesystem — unused by
 * index/search themselves (those go through the vector store), it just satisfies
 * the constructor and keeps the fs/index scoped to the same tenant. Used by the
 * save-time indexer, the reindex backfill, and the E2E probe.
 */
export function buildTenantKnowledgeWorkspace(tenantKey: string): Workspace {
  const dir = path.join(WORKSPACE_PATH, tenantKey);
  return new Workspace({
    id: `foreman-knowledge-${knowledgeIndexName(tenantKey)}`,
    filesystem: resolveFsProvider(dir),
    vectorStore: getKnowledgeVector(),
    embedder: knowledgeEmbedder,
    searchIndexName: knowledgeIndexName(tenantKey),
  });
}

/**
 * Index one SHARED knowledge document into its workspace's index via the native
 * `Workspace.index` (reusing Mastra's embedding + upsert, so the same
 * `mastra_workspace_search` tool retrieves it). Re-embeds the doc on each call —
 * fine: fastembed is local (no API cost) and this runs only on an explicit save.
 * Personal (`_private/`) docs are intentionally NOT indexed here — they would
 * land in the same per-workspace index and become searchable by teammates
 * (personal search is a per-user-index follow-up).
 */
export async function indexSharedDoc(args: {
  tenantKey: string;
  path: string;
  content: string;
  title: string;
}): Promise<void> {
  await buildTenantKnowledgeWorkspace(args.tenantKey).index(args.path, args.content, {
    metadata: { title: args.title, path: args.path },
  });
}
