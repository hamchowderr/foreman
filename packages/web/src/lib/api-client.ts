import "server-only";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function apiClient(
  path: string,
  token: string,
  options?: RequestInit
) {
  const res = await fetch(`${AGENT_SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`Agent server error: ${res.status}`);
  return res;
}

export async function getConversations(token: string) {
  const res = await apiClient("/conversations", token);
  return res.json();
}

export async function getConversation(id: string, token: string) {
  const res = await apiClient(`/conversations/${id}`, token);
  return res.json();
}

export async function getMessages(conversationId: string, token: string) {
  const res = await apiClient(
    `/conversations/${conversationId}/messages`,
    token
  );
  return res.json();
}

export async function createConversation(
  data: { id: string; title: string },
  token: string
) {
  const res = await apiClient("/conversations", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteConversation(id: string, token: string) {
  const res = await apiClient(`/conversations/${id}`, token, {
    method: "DELETE",
  });
  return res.json();
}

export async function updateConversation(
  id: string,
  data: { title?: string },
  token: string
) {
  const res = await apiClient(`/conversations/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.json();
}
