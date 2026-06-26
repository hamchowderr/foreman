import { LocalFilesystem, LocalSandbox, Workspace } from "@mastra/core/workspace";

/**
 * Foreman's agent workspace — a single shared LocalFilesystem + LocalSandbox the
 * agent uses for file ops and command execution. Extracted to a module singleton
 * (was inline in createForemanAgent) so server-side helpers (e.g. the live-preview
 * server in lib/preview) can drive the same filesystem + sandbox the agent sees.
 *
 * SPIKE / known limits (foreman-qq4x):
 * - Single shared dir — NOT per-tenant yet (foreman-jgme tracks the workspace_id
 *   dynamic resolver).
 * - Relative `./data/workspace` resolves from process.cwd(), which differs under
 *   `mastra dev` vs `mastra start` — switch to an absolute WORKSPACE_PATH later.
 */
const WORKSPACE_PATH = process.env.FOREMAN_WORKSPACE_PATH ?? "./data/workspace";

export const foremanWorkspace = new Workspace({
  id: "foreman-workspace",
  name: "Foreman Workspace",
  filesystem: new LocalFilesystem({
    basePath: WORKSPACE_PATH,
    contained: true,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: WORKSPACE_PATH,
  }),
  bm25: true,
  tools: {
    mastra_workspace_write_file: { requireApproval: true },
    mastra_workspace_edit_file: { requireApproval: true },
    mastra_workspace_delete: { requireApproval: true },
    mastra_workspace_execute_command: { requireApproval: true },
  },
});
