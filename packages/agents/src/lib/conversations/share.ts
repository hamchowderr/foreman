import { randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "../db";

/**
 * Public share links for chats (foreman-mk25, rebuilt on the chat kit). Same
 * capability model as dashboard_share / document_share: whoever holds a valid,
 * unexpired `share_token` can read that chat on a logged-out page — no account.
 *
 * A chat is OWNER-scoped: only its owner mints or revokes a link. The chat is an
 * AgentController thread, and ownership means "the thread is in the owner's own
 * Session thread list" — the route checks that (it needs the controller, which
 * this lib stays free of) before calling `createShare`. Revoking deletes the row;
 * the chat itself is untouched.
 */

export interface ChatShare {
  token: string;
  expiresAt: string | null;
}

/**
 * Mint a share token for a thread the caller owns (the route has verified that).
 * `expiresInDays` is optional — omit it for a link that never expires.
 */
export async function createShare(
  userId: string,
  threadId: string,
  opts: { workspaceId?: string; expiresInDays?: number } = {},
): Promise<ChatShare> {
  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

  const { error } = await getSupabase()
    .from("conversation_share")
    .insert({
      id: randomUUID(),
      thread_id: threadId,
      workspace_id: opts.workspaceId ?? null,
      user_id: userId,
      share_token: token,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    });
  if (error) throw new Error(`createShare failed: ${error.message}`);

  return { token, expiresAt };
}

/** The chat's current share link, or null if it isn't shared. */
export async function getShare(userId: string, threadId: string): Promise<ChatShare | null> {
  const { data } = await getSupabase()
    .from("conversation_share")
    .select("share_token, expires_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return null;
  return { token: data.share_token, expiresAt: data.expires_at };
}

/**
 * Stop sharing a chat: removes every link the owner made for it, so an older
 * leaked link dies with the current one. Returns true if anything was removed.
 */
export async function revokeShares(userId: string, threadId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from("conversation_share")
    .delete()
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .select("id");
  return (data?.length ?? 0) > 0;
}

export interface SharedChatRef {
  threadId: string;
  ownerId: string;
}

/**
 * Resolve a public token to the chat it shares. Null when the token is unknown or
 * expired. No auth — the token is the capability.
 */
export async function resolveShareToken(token: string): Promise<SharedChatRef | null> {
  const { data } = await getSupabase()
    .from("conversation_share")
    .select("thread_id, user_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return null;
  return { threadId: data.thread_id, ownerId: data.user_id };
}
