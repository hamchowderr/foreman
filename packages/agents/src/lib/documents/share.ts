import { randomBytes, randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import { foremanWorkspace } from "../../mastra/agents/workspace";
import { getSupabase } from "../db";
import { readManifest, slugFromPath } from "./versions";

/**
 * Public share tokens for knowledge documents (foreman-jz14). Mirrors the
 * dashboard_share capability model (lib/dashboards/share.ts): whoever holds a
 * valid, unexpired `share_token` can read that document on a logged-out page —
 * no auth, no account. The row carries the owner's `workspace_id` so the public
 * read resolves the document from the owner's per-tenant Workspace filesystem
 * without the viewer being authenticated. Revoking = delete the row; the
 * document is untouched, so a leaked token can be cut independently.
 */

export interface CreateDocumentShareResult {
  token: string;
  expiresAt: string | null;
}

/** Resolve a workspace's filesystem by id (same as the documents route). */
function resolveFs(workspaceId: string) {
  return foremanWorkspace.resolveFilesystem({
    requestContext: new RequestContext([["workspaceId", workspaceId]]),
  });
}

/** documents/q3-launch-plan.md → "Q3 Launch Plan" (fallback when no manifest). */
function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Mint a public share token for a document the caller owns. Verifies the file
 * exists in the caller's workspace before minting (so the route can 404 without
 * leaking existence). Snapshots the document title for display on the share page.
 * `expiresInDays` is optional — omit for a link that never expires.
 */
export async function createDocumentShare(
  workspaceId: string | undefined,
  userId: string,
  docPath: string,
  opts: { expiresInDays?: number } = {},
): Promise<CreateDocumentShareResult | null> {
  if (!workspaceId) return null;
  const slug = slugFromPath(docPath);
  if (!slug) return null;

  const fs = await resolveFs(workspaceId);
  if (!fs || !(await fs.exists(docPath))) return null;

  const manifest = await readManifest(fs, docPath).catch(() => null);
  const title = manifest?.title || titleFromSlug(slug);

  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

  const { error } = await getSupabase().from("document_share").insert({
    id: randomUUID(),
    doc_path: docPath,
    title,
    workspace_id: workspaceId,
    user_id: userId,
    share_token: token,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });
  if (error) throw new Error(`createDocumentShare failed: ${error.message}`);

  return { token, expiresAt };
}

/**
 * Revoke a document share, scoped to the workspace so any member can revoke one
 * of the workspace's shared documents. Returns true if a row was deleted.
 */
export async function revokeDocumentShare(
  workspaceId: string | undefined,
  token: string,
): Promise<boolean> {
  if (!workspaceId) return false;
  const { data } = await getSupabase()
    .from("document_share")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("share_token", token)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/** The existing share token for a document, or null if it isn't shared. */
export async function getDocumentShareToken(
  workspaceId: string | undefined,
  docPath: string,
): Promise<{ token: string; expiresAt: string | null } | null> {
  if (!workspaceId) return null;
  const { data } = await getSupabase()
    .from("document_share")
    .select("share_token, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("doc_path", docPath)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { token: data.share_token, expiresAt: data.expires_at };
}

/**
 * Resolve a public share token to its document content. Returns null when the
 * token is unknown, expired, or the document no longer exists. No auth — the
 * token is the capability; the document is read from the owner's workspace fs
 * using the trusted `workspace_id` stored on the share row.
 */
export async function getSharedDocument(
  token: string,
): Promise<{ title: string; path: string; content: string } | null> {
  const { data: share } = await getSupabase()
    .from("document_share")
    .select("doc_path, title, workspace_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!share?.workspace_id) return null;

  if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) {
    return null; // expired — treat as not found
  }

  const fs = await resolveFs(share.workspace_id);
  if (!fs) return null;
  try {
    const raw = await fs.readFile(share.doc_path);
    const content = typeof raw === "string" ? raw : raw.toString("utf8");
    return {
      title: share.title || titleFromSlug(slugFromPath(share.doc_path) ?? "document"),
      path: share.doc_path,
      content,
    };
  } catch {
    return null;
  }
}
