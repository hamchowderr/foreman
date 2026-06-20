import { randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/db";
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
 * Mint a public share token for an artifact the caller owns. Returns null if the
 * artifact doesn't exist or isn't theirs (so the route can 404 without leaking
 * existence). `expiresInDays` is optional — omit for a link that never expires.
 */
export async function createShare(
  userId: string,
  artifactId: string,
  opts: { expiresInDays?: number } = {},
): Promise<CreateShareResult | null> {
  const supabase = getSupabase();

  // Verify ownership before minting a token — never share someone else's row.
  const { data: owned } = await supabase
    .from("artifact")
    .select("id")
    .eq("user_id", userId)
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
    .eq("user_id", userId);

  return { token, expiresAt };
}

/**
 * Revoke a share, scoped to the owner so one user can't delete another's token.
 * Returns true if a row was deleted.
 */
export async function revokeShare(userId: string, token: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("dashboard_share")
    .delete()
    .eq("user_id", userId)
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
    .select("artifact_id, user_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!share) return null;

  if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) {
    return null; // expired — treat as not found
  }

  // Reuse the owner-scoped loader: the share row carries the owner's id, so the
  // records (scoped to the owner in the snapshot read) still resolve.
  return getArtifactWithData(share.user_id, share.artifact_id);
}
