import type { AppChunk } from "./types";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

async function getClerkToken(): Promise<string | null> {
  try {
    // Client-side: use Clerk's global session to get a JWT
    const session = (window as any).__clerk?.session;
    if (session) return await session.getToken();
  } catch {}
  return null;
}

async function agentFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getClerkToken();
  return fetch(`${AGENT_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function throwIfNotOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  let detail = "";
  try {
    const body = await res.json();
    detail = body.error ?? body.message ?? JSON.stringify(body);
  } catch {
    detail = res.statusText;
  }
  throw new Error(`${label} (${res.status}): ${detail}`);
}

export async function createConversation() {
  const res = await agentFetch("/api/conversations", { method: "POST" });
  await throwIfNotOk(res, "Failed to create conversation");
  return res.json() as Promise<{
    id: string;
    mastra_thread_id: string;
    title: string | null;
    created_at: string;
  }>;
}

export async function listConversations() {
  const res = await agentFetch("/api/conversations");
  await throwIfNotOk(res, "Failed to list conversations");
  return res.json() as Promise<
    Array<{
      id: string;
      title: string | null;
      created_at: string;
      updated_at: string;
    }>
  >;
}

export async function getConversation(id: string) {
  const res = await agentFetch(`/api/conversations/${id}`);
  await throwIfNotOk(res, "Failed to get conversation");
  return res.json() as Promise<{
    conversation: {
      id: string;
      title: string | null;
      created_at: string;
    };
    messages: Array<{
      id: string;
      role: "user" | "agent" | "system";
      content: string;
      created_at: string;
    }>;
  }>;
}

export async function patchProposal(
  proposalId: string,
  inputs: Record<string, unknown>
) {
  const res = await agentFetch(`/api/proposals/${proposalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  await throwIfNotOk(res, "Failed to update proposal");
  return res.json();
}

export async function fetchFieldChoices(
  proposalId: string,
  fieldKey: string
) {
  const res = await agentFetch(
    `/api/proposals/${proposalId}/field-choices/${fieldKey}`
  );
  await throwIfNotOk(res, "Failed to fetch field choices");
  return res.json() as Promise<{
    choices: Array<{ label: string; value: string }>;
  }>;
}

/**
 * Send a message and return an async iterator of AppChunks via SSE.
 */
export async function* streamMessage(
  conversationId: string,
  content: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await agentFetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch {
    throw new Error("Network error — check your connection");
  }

  await throwIfNotOk(res, "Failed to send message");
  yield* readSSEStream(res);
}

/**
 * Approve a proposal and return an async iterator of AppChunks via SSE.
 */
export async function* streamApprove(
  proposalId: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await agentFetch(`/api/proposals/${proposalId}/approve`, {
      method: "POST",
    });
  } catch {
    throw new Error("Network error — check your connection");
  }

  await throwIfNotOk(res, "Failed to approve");
  yield* readSSEStream(res);
}

/**
 * Decline a proposal and return an async iterator of AppChunks via SSE.
 */
export async function* streamDecline(
  proposalId: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await agentFetch(`/api/proposals/${proposalId}/decline`, {
      method: "POST",
    });
  } catch {
    throw new Error("Network error — check your connection");
  }

  await throwIfNotOk(res, "Failed to decline");
  yield* readSSEStream(res);
}

async function* readSSEStream(res: Response): AsyncGenerator<AppChunk> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const json = trimmed.slice(6);
        try {
          yield JSON.parse(json) as AppChunk;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}
