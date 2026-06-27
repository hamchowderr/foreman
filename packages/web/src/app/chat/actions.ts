"use server";

import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/server";
import { getTextFromMessage } from "@/lib/utils";

const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({ message }: { message: UIMessage }) {
  const text = getTextFromMessage(message);
  return text.split(/\s+/).slice(0, 6).join(" ").trim() || "New Chat";
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  console.warn("deleteTrailingMessages not yet supported by agent server", { id });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const supabase = await createClient();
  const {
    data: { session: supaSession },
  } = await supabase.auth.getSession();
  if (!supaSession) throw new Error("Unauthorized");

  const res = await fetch(`${AGENT_SERVER_URL}/conversations/${chatId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supaSession.access_token}`,
    },
    body: JSON.stringify({ visibility }),
  });

  if (!res.ok) throw new Error(`Failed to update visibility: ${res.status}`);
}

/** Bearer token for the current Supabase session, or throw if logged out. */
async function requireAgentToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthorized");
  return session.access_token;
}

export interface ChatShareLink {
  token: string;
  url: string;
  expiresAt: string | null;
}

/** The chat's existing public link, or null if it isn't shared (foreman-mk25). */
export async function getChatShareLink(chatId: string): Promise<ChatShareLink | null> {
  const token = await requireAgentToken();
  const res = await fetch(`${AGENT_SERVER_URL}/conversations/${chatId}/share`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to read share link: ${res.status}`);
  const data = (await res.json()) as {
    token: string | null;
    url?: string;
    expiresAt?: string | null;
  };
  if (!data.token || !data.url) return null;
  return { token: data.token, url: data.url, expiresAt: data.expiresAt ?? null };
}

/** Mint a public share link for a chat the caller owns (foreman-mk25). */
export async function shareChat(chatId: string): Promise<ChatShareLink> {
  const token = await requireAgentToken();
  const res = await fetch(`${AGENT_SERVER_URL}/conversations/${chatId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Failed to create share link: ${res.status}`);
  return (await res.json()) as ChatShareLink;
}

/** Revoke a chat's public share link (foreman-mk25). */
export async function unshareChat(shareToken: string): Promise<void> {
  const token = await requireAgentToken();
  const res = await fetch(`${AGENT_SERVER_URL}/conversations/shares/${shareToken}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to revoke share link: ${res.status}`);
}
