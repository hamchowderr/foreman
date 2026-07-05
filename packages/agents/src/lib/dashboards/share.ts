import { randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "../db";
import { type ArtifactWithData, getArtifactWithData } from "./artifact";

/**
 * Public share tokens for dashboard artifacts (Phase 3).
 *
 * A token is an unguessable capability: whoever holds a valid, unexpired
 * `share_token` can view that artifact's spec + records on the logged-out share
 * page. The row carries the owner's `user_id`, so the public read resolves the
 * (owner-scoped) records without the viewer being authenticated. Revoking a
 * share = delete its row; the artifact itself is untouched.
 */

export interface CreateShareResult {
  token: string;
  expiresAt: string | null;
}

/**
 * Mint a public share token for a workspace dashboard. Any member of the
 * workspace can share it (dashboards are a SHARED resource); `userId` is recorded
 * only as the share's creator. Returns null if the artifact doesn't exist in this
 * workspace (so the route can 404 without leaking existence). `expiresInDays` is
 * optional — omit for a link that never expires.
 */
export async function createShare(
  workspaceId: string | undefined,
  userId: string,
  artifactId: string,
  opts: { expiresInDays?: number } = {},
): Promise<CreateShareResult | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();

  // Verify the artifact belongs to this workspace before minting a token.
  const { data: owned } = await supabase
    .from("artifact")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", artifactId)
    .maybeSingle();
  if (!owned) return null;

  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

  const { error } = await supabase.from("dashboard_share").insert({
    id: randomUUID(),
    artifact_id: artifactId,
    workspace_id: workspaceId,
    user_id: userId,
    share_token: token,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });
  if (error) throw new Error(`createShare failed: ${error.message}`);

  // Reflect the shared state on the artifact (a UI signal only — access stays
  // gated on the token, so this is best-effort and non-fatal).
  await supabase
    .from("artifact")
    .update({ visibility: "link" })
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId);

  return { token, expiresAt };
}

/**
 * Revoke a share, scoped to the workspace so a member can revoke any of the
 * workspace's shared dashboards. Returns true if a row was deleted.
 */
export async function revokeShare(
  workspaceId: string | undefined,
  token: string,
): Promise<boolean> {
  if (!workspaceId) return false;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("dashboard_share")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("share_token", token)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Resolve a public share token to its artifact + data. Returns null when the
 * token is unknown, expired, or the artifact no longer exists. No auth — the
 * token is the capability.
 */
export async function getSharedArtifact(token: string): Promise<ArtifactWithData | null> {
  const supabase = getSupabase();
  const { data: share } = await supabase
    .from("dashboard_share")
    .select("artifact_id, workspace_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!share) return null;

  if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) {
    return null; // expired — treat as not found
  }

  // The share row carries the artifact's workspace, so the (workspace-scoped)
  // records still resolve for an unauthenticated viewer — the token is the grant.
  return getArtifactWithData(share.workspace_id ?? undefined, share.artifact_id);
}
