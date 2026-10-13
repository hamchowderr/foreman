/**
 * Typed client for the agents server's /chat-shares/* routes (foreman-mk25):
 * public, logged-out links to one chat. The browser calls the agent server
 * directly with the Supabase access token (same pattern as documents-client).
 */
import { createClient } from "@/lib/client";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export interface ChatShare {
  token: string | null;
  expiresAt: string | null;
}

export interface SharedChat {
  title: string;
  createdAt: string | null;
  messages: { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[];
}

async function call<T>(method: string, threadId: string): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  const res = await fetch(`${AGENT_URL}/chat-shares/${encodeURIComponent(threadId)}`, {
    method,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${method} /chat-shares → ${res.status}`);
  }
  return (await res.json()) as T;
}

/** The chat's current link (token null when it isn't shared). */
export function getChatShare(threadId: string): Promise<ChatShare> {
  return call("GET", threadId);
}

/** Create the chat's link, or return the one it already has. */
export function shareChat(threadId: string): Promise<ChatShare> {
  return call("POST", threadId);
}

/** Turn the chat's link off. */
export function unshareChat(threadId: string): Promise<{ revoked: boolean }> {
  return call("DELETE", threadId);
}

/** The page path a share token opens. */
export function chatShareUrl(token: string): string {
  return `${window.location.origin}/c/${token}`;
}

/**
 * Read a shared chat by token — NO auth, for the logged-out share page
 * (server-side fetch). Null when the link is unknown, revoked or expired.
 */
export async function getSharedChat(token: string): Promise<SharedChat | null> {
  const res = await fetch(`${AGENT_URL}/chat-shares/public/${encodeURIComponent(token)}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GET /chat-shares/public → ${res.status}`);
  }
  return (await res.json()) as SharedChat;
}
