/**
 * Read-only view of the caller's PER-TENANT workspace for the chat kit's Files panel
 * (Foreman's version of the kit's lib/workspace-files.ts, which walks one shared
 * folder on disk). Reads go through the tenant's WorkspaceFilesystem — the same one
 * the agent's workspace tools use — so a user only ever sees their own workspace,
 * and the filesystem provider's own path confinement applies.
 */

import { RequestContext } from "@mastra/core/request-context";
import { resolveWorkspaceFilesystem, resolveWorkspaceTenantKey } from "../agents/workspace";
import type { ChatKitCaller, WorkspaceNode } from "../routes/types";

const IGNORE = new Set([".git", "node_modules", ".DS_Store"]);
const MAX_NODES = 2000;
const MAX_FILE_CHARS = 200_000;

function contextFor({ userId, workspaceId }: ChatKitCaller): RequestContext {
  const entries: Array<[string, string]> = [];
  if (userId) entries.push(["userId", userId]);
  if (workspaceId) entries.push(["workspaceId", workspaceId]);
  return new RequestContext(entries);
}

/** A label for the Files panel header: the tenant key, never a server path. */
export async function workspaceRootLabel(who: ChatKitCaller): Promise<string> {
  return resolveWorkspaceTenantKey(contextFor(who));
}

/** Walk the tenant's workspace into a nested tree (dirs first, then alphabetical). */
export async function readWorkspaceTree(who: ChatKitCaller): Promise<WorkspaceNode[]> {
  const fs = await resolveWorkspaceFilesystem(contextFor(who));
  let count = 0;

  async function walk(dir: string): Promise<WorkspaceNode[]> {
    // A missing/unreadable dir → empty (the workspace may not exist yet).
    const entries = await fs.readdir(dir || ".").catch(() => []);
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const nodes: WorkspaceNode[] = [];
    for (const e of entries) {
      if (IGNORE.has(e.name) || e.isSymlink) continue;
      if (count++ > MAX_NODES) break;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.type === "directory") {
        nodes.push({ name: e.name, path: rel, type: "dir", children: await walk(rel) });
      } else {
        nodes.push({ name: e.name, path: rel, type: "file" });
      }
    }
    return nodes;
  }

  return walk("");
}

/** Read one file's text from the tenant's workspace. Null when it can't be read. */
export async function readWorkspaceFile(
  relPath: string,
  who: ChatKitCaller,
): Promise<{ path: string; content: string; truncated: boolean } | null> {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").includes("..")) return null;
  try {
    const fs = await resolveWorkspaceFilesystem(contextFor(who));
    const raw = String(await fs.readFile(normalized, { encoding: "utf-8" }));
    const truncated = raw.length > MAX_FILE_CHARS;
    return {
      path: normalized,
      content: truncated ? `${raw.slice(0, MAX_FILE_CHARS)}\n\n… (truncated)` : raw,
      truncated,
    };
  } catch {
    return null;
  }
}
