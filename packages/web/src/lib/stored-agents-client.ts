const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export interface StoredAgentVersion {
  id: string;
  agent_id: string;
  version: number;
  instructions: string;
  tools: string[];
  model: string;
  notes: string | null;
  published_at: string | null;
  created_at: string;
  is_draft: boolean;
}

export interface StoredAgent {
  id: string;
  name: string;
  description: string | null;
  current_version_id: string | null;
  latest_version: StoredAgentVersion | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogTool {
  id: string;
  description: string;
  read_only: boolean;
  requires_approval: boolean;
  category: "zapier" | "custom";
}

/**
 * Client-side fetch that relies on the Clerk `useAuth()` token being injected
 * by the caller. For server-side calls, use `fetchServer` which reads the
 * token via `@clerk/nextjs/server`.
 */
async function fetchJson<T>(
  path: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  if (!token) throw new Error("Unauthorized");
  const res = await fetch(`${AGENT_SERVER_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const storedAgentsApi = {
  list: (token: string) => fetchJson<StoredAgent[]>("/stored/agents", token),

  get: (token: string, id: string) =>
    fetchJson<StoredAgent>(`/stored/agents/${id}`, token),

  create: (token: string, body: { name: string; description?: string }) =>
    fetchJson<StoredAgent>("/stored/agents", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (
    token: string,
    id: string,
    body: { name?: string; description?: string | null }
  ) =>
    fetchJson<StoredAgent>(`/stored/agents/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (token: string, id: string) =>
    fetchJson<{ ok: true }>(`/stored/agents/${id}`, token, { method: "DELETE" }),

  listVersions: (token: string, id: string) =>
    fetchJson<StoredAgentVersion[]>(`/stored/agents/${id}/versions`, token),

  getVersion: (token: string, id: string, versionId: string) =>
    fetchJson<StoredAgentVersion>(
      `/stored/agents/${id}/versions/${versionId}`,
      token
    ),

  createDraft: (
    token: string,
    id: string,
    body?: { sourceVersionId?: string }
  ) =>
    fetchJson<StoredAgentVersion>(`/stored/agents/${id}/versions`, token, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  updateDraft: (
    token: string,
    id: string,
    versionId: string,
    body: {
      instructions?: string;
      tools?: string[];
      model?: string;
      notes?: string | null;
    }
  ) =>
    fetchJson<StoredAgentVersion>(
      `/stored/agents/${id}/versions/${versionId}`,
      token,
      { method: "PATCH", body: JSON.stringify(body) }
    ),

  publish: (token: string, id: string, versionId: string) =>
    fetchJson<{ agent: StoredAgent; version: StoredAgentVersion }>(
      `/stored/agents/${id}/versions/${versionId}/publish`,
      token,
      { method: "POST" }
    ),

  listTools: (token: string) =>
    fetchJson<{ tools: CatalogTool[] }>("/stored/agents/tools", token),
};
