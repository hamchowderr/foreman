import path from "node:path";
import { LocalFilesystem, LocalSandbox, Workspace } from "@mastra/core/workspace";
import { resolveActiveWorkspace } from "../../lib/identity";
import { requestUserContext } from "../../lib/request-user-context";

/**
 * Foreman's agent workspace — a LocalFilesystem + LocalSandbox the agent uses for
 * file ops and command execution, now scoped PER TENANT (foreman-jgme).
 *
 * Previously a single shared ./data/workspace, which is a multi-tenant
 * collision/privacy bug (every user's files in one dir) and a blocker for the
 * knowledge layer (foreman-aqjx) and team-shared skills (foreman-vb78). The
 * filesystem + sandbox are now Mastra dynamic resolvers keyed by workspace_id, so
 * each workspace gets its own `./data/workspace/<workspace_id>` directory.
 *
 * Where workspace_id comes from (in priority order):
 *  1. `RequestContext` — the web /chat route already resolves it and sets
 *     `workspaceId` (mastra/index.ts), so no extra DB hit on that path.
 *  2. `requestUserContext` (AsyncLocalStorage `{ userId }`) — every channel bot
 *     wraps `agent.generate` in `requestUserContext.run({ userId })`, so the
 *     resolver back-resolves the active workspace from the userId. This covers
 *     all 9 channels without editing each bot.
 *  3. Fallback to a shared `_shared` dir when neither is present (e.g. the
 *     proposals approve/decline path, which executes Zapier actions and does not
 *     touch the workspace filesystem). Tracked as the remaining jgme slice.
 *
 * Resolver-backed providers (no static instance) — nothing accesses
 * `foremanWorkspace.filesystem`/`.sandbox` directly, so this is safe. Self-host
 * uses LocalFilesystem; a cloud S3/AgentFS provider keyed off DEPLOY_TARGET is a
 * follow-up increment.
 */
const WORKSPACE_PATH = process.env.FOREMAN_WORKSPACE_PATH ?? "./data/workspace";
const SHARED_DIR = "_shared";

/** Defensive against path traversal — workspace ids are UUIDs in practice. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** The per-tenant base directory for the current request. */
async function resolveWorkspaceDir(requestContext?: {
  get(key: string): unknown;
}): Promise<string> {
  let wsId = (requestContext?.get("workspaceId") as string | undefined) ?? undefined;
  if (!wsId) {
    const userId = requestUserContext.getStore()?.userId;
    if (userId) {
      wsId = (await resolveActiveWorkspace(userId).catch(() => null)) ?? undefined;
    }
  }
  return path.join(WORKSPACE_PATH, wsId ? sanitizeId(wsId) : SHARED_DIR);
}

export const foremanWorkspace = new Workspace({
  id: "foreman-workspace",
  name: "Foreman Workspace",
  filesystem: async ({ requestContext }) => {
    const basePath = await resolveWorkspaceDir(requestContext);
    return new LocalFilesystem({ basePath, contained: true });
  },
  sandbox: async ({ requestContext }) => {
    const workingDirectory = await resolveWorkspaceDir(requestContext);
    return new LocalSandbox({ workingDirectory });
  },
  // Memoize the resolver-backed sandbox per workspace when the id is already in
  // RequestContext (the web path). Sync-only, so channels (ALS-resolved) fall
  // back to per-RequestContext caching — correct, just not shared across requests.
  sandboxCacheKey: ({ requestContext }) =>
    (requestContext?.get("workspaceId") as string | undefined) ?? undefined,
  bm25: true,
  tools: {
    mastra_workspace_write_file: { requireApproval: true },
    mastra_workspace_edit_file: { requireApproval: true },
    mastra_workspace_delete: { requireApproval: true },
    mastra_workspace_execute_command: { requireApproval: true },
  },
});
