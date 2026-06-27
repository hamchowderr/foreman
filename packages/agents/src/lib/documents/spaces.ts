/**
 * Document Spaces (foreman-5e4f, under collaboration epic foreman-wl54).
 *
 * The per-tenant Workspace filesystem (foreman-jgme) is keyed by workspace_id, so
 * `documents/` is implicitly SHARED across every member of a workspace. To give
 * users a private tier we add a second space stored under a per-user subtree:
 *
 *   SHARED   → documents/<slug>.md                       (all workspace members)
 *   PERSONAL → _private/<userId>/documents/<slug>.md      (only the creator)
 *
 * The client never constructs a private path — it only ever uses physical paths
 * the LIST endpoint handed it, and the server re-validates ownership on every
 * access via `canAccessDocPath`. A personal path embeds the *caller's own* userId,
 * never another user's, so it leaks nothing and can't be used to enumerate others.
 */

export type DocSpace = "shared" | "personal";

const SHARED_DIR = "documents";
const PRIVATE_ROOT = "_private";

/** Filesystem-safe id segment (mirrors workspace.ts sanitizeId). */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Physical docs root dir within the workspace fs for a space. */
export function docsRoot(space: DocSpace, userId: string | undefined): string {
  if (space === "personal") {
    const uid = userId ? sanitizeId(userId) : "";
    if (!uid) throw new Error("personal space requires a userId");
    return `${PRIVATE_ROOT}/${uid}/${SHARED_DIR}`;
  }
  return SHARED_DIR;
}

/** Physical live path for a (space, slug). */
export function docPath(space: DocSpace, userId: string | undefined, slug: string): string {
  return `${docsRoot(space, userId)}/${slug}.md`;
}

/** Which space a physical path belongs to. */
export function spaceOfPath(path: string): DocSpace {
  return path.startsWith(`${PRIVATE_ROOT}/`) ? "personal" : "shared";
}

/**
 * Whether `userId` may access the document at physical `path`: a top-level doc in
 * the shared `documents/` dir, or one in their OWN `_private/<uid>/documents/`
 * dir. Blocks `..` traversal, absolute paths, nested subpaths, history/json files,
 * and any other user's private subtree.
 */
export function canAccessDocPath(path: string, userId: string | undefined): boolean {
  if (!path || path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
    return false;
  }
  if (/^documents\/[^/]+\.md$/.test(path)) {
    return true;
  }
  if (userId) {
    const uid = sanitizeId(userId);
    if (uid && new RegExp(`^${PRIVATE_ROOT}/${uid}/documents/[^/]+\\.md$`).test(path)) {
      return true;
    }
  }
  return false;
}
