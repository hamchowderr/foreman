const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export interface PublicChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string }>;
}

export interface PublicConversation {
  conversation: { id: string; title: string | null; created_at: string };
  messages: PublicChatMessage[];
}

/**
 * Fetch a publicly-shared chat by token (foreman-mk25). No auth — the token in the
 * URL is the capability, validated + expiry-checked by the agent's
 * /conversations/public/:token endpoint. Server-component use; no-store so the
 * share reflects the latest thread state. Returns null on 404 (unknown/expired).
 */
export async function getPublicConversation(
  shareToken: string,
): Promise<PublicConversation | null> {
  const res = await fetch(`${AGENT_URL}/conversations/public/${encodeURIComponent(shareToken)}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /conversations/public → ${res.status}`);
  return (await res.json()) as PublicConversation;
}
