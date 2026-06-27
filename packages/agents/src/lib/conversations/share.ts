import { randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "../db";

/**
 * Public share tokens for chat conversations (foreman-mk25). Mirrors the
 * dashboard_share / document_share capability model: whoever holds a valid,
 * unexpired `share_token` can read that chat on a logged-out page — no auth, no
 * account.
 *
 * Unlike dashboards/documents (SHARED workspace resources), a chat is
 * OWNER-scoped: only the owner mints/revokes a link for their own chat, so
 * create/revoke gate on `user_id` (a solo user with no teammates can still share
 * their chat). Token resolution returns just the conversation's thread id; the
 * route loads the messages from Mastra Memory by that thread id (recall is not
 * resourceId-gated, so the unauthenticated read works) — keeping this lib free of
 * the mastra index to avoid a circular import (same pattern as documents/share).
 * Revoking = delete the row; the chat is untouched, so a leaked token can be cut
 * independently of the chat's private/workspace visibility.
 */

export interface CreateShareResult {
  token: string;
  expiresAt: string | null;
}

/**
 * Mint a public share token for a chat the caller OWNS. Verifies ownership before
 * minting (so the route can 404 without leaking existence). `expiresInDays` is
 * optional — omit for a link that never expires.
 */
export async function createShare(
  userId: string,
  conversationId: string,
  opts: { expiresInDays?: number } = {},
): Promise<CreateShareResult | null> {
  const supabase = getSupabase();

  // Only the owner can share their chat.
  const { data: owned } = await supabase
    .from("conversation")
    .select("id, workspace_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!owned) return null;

  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

  const { error } = await supabase.from("conversation_share").insert({
    id: randomUUID(),
    conversation_id: conversationId,
    workspace_id: owned.workspace_id ?? null,
    user_id: userId,
    share_token: token,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });
  if (error) throw new Error(`createShare failed: ${error.message}`);

  return { token, expiresAt };
}

/**
 * Revoke a share, scoped to the owner so only the chat's owner can cut its link.
 * Returns true if a row was deleted.
 */
export async function revokeShare(userId: string, token: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from("conversation_share")
    .delete()
    .eq("user_id", userId)
    .eq("share_token", token)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/** The existing share token for a chat, or null if it isn't shared (UI signal). */
export async function getConversationShareToken(
  userId: string,
  conversationId: string,
): Promise<{ token: string; expiresAt: string | null } | null> {
  const { data } = await getSupabase()
    .from("conversation_share")
    .select("share_token, expires_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { token: data.share_token, expiresAt: data.expires_at };
}

export interface SharedConversationRef {
  conversationId: string;
  threadId: string | null;
  /** The owner's explicit title (trimmed), or null to fall back to the thread title. */
  title: string | null;
  createdAt: string;
}

/**
 * Resolve a public share token to its chat reference. Returns null when the token
 * is unknown, expired, or the chat no longer exists. No auth — the token is the
 * capability. The route loads the messages from Mastra Memory by `threadId` (recall
 * is not resourceId-gated), so this lib stays free of the mastra index.
 */
export async function getSharedConversation(token: string): Promise<SharedConversationRef | null> {
  const supabase = getSupabase();
  const { data: share } = await supabase
    .from("conversation_share")
    .select("conversation_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!share) return null;

  if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) {
    return null; // expired — treat as not found
  }

  const { data: conv } = await supabase
    .from("conversation")
    .select("id, title, mastra_thread_id, created_at")
    .eq("id", share.conversation_id)
    .maybeSingle();
  if (!conv) return null;

  return {
    conversationId: conv.id,
    threadId: conv.mastra_thread_id ?? null,
    title: conv.title?.trim() || null,
    createdAt: conv.created_at,
  };
}
