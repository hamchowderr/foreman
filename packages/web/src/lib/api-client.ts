import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo } from "react";
import type { AppChunk } from "./types";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

/**
 * Hook that returns an authenticated fetch function using Clerk's official API.
 * All agent API calls should go through the returned `agentFetch`.
 */
export function useAgentFetch() {
  const { getToken } = useAuth();

  const agentFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await getToken();
      return fetch(`${AGENT_URL}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [getToken]
  );

  return agentFetch;
}

type AgentFetch = (path: string, init?: RequestInit) => Promise<Response>;

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

export async function createConversation(fetcher: AgentFetch) {
  const res = await fetcher("/api/conversations", { method: "POST" });
  await throwIfNotOk(res, "Failed to create conversation");
  return res.json() as Promise<{
    id: string;
    mastra_thread_id: string;
    title: string | null;
    created_at: string;
  }>;
}

export async function listConversations(fetcher: AgentFetch) {
  const res = await fetcher("/api/conversations");
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

export async function getConversation(fetcher: AgentFetch, id: string) {
  const res = await fetcher(`/api/conversations/${id}`);
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
  fetcher: AgentFetch,
  proposalId: string,
  inputs: Record<string, unknown>
) {
  const res = await fetcher(`/api/proposals/${proposalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  await throwIfNotOk(res, "Failed to update proposal");
  return res.json();
}

export async function fetchFieldChoices(
  fetcher: AgentFetch,
  proposalId: string,
  fieldKey: string
) {
  const res = await fetcher(
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
  fetcher: AgentFetch,
  conversationId: string,
  content: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await fetcher(`/api/conversations/${conversationId}/messages`, {
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
  fetcher: AgentFetch,
  proposalId: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await fetcher(`/api/proposals/${proposalId}/approve`, {
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
  fetcher: AgentFetch,
  proposalId: string
): AsyncGenerator<AppChunk> {
  let res: Response;
  try {
    res = await fetcher(`/api/proposals/${proposalId}/decline`, {
      method: "POST",
    });
  } catch {
    throw new Error("Network error — check your connection");
  }

  await throwIfNotOk(res, "Failed to decline");
  yield* readSSEStream(res);
}

// ─── Workflows ───

export interface WorkflowSummary {
  id: string;
  name: string;
  source_conversation_id: string | null;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDetail {
  workflow: WorkflowSummary;
  steps: Array<{
    id: string;
    order: number;
    proposal_template: Record<string, unknown>;
  }>;
}

export interface WorkflowRunSummary {
  id: string;
  workflow_id: string;
  inputs: Record<string, unknown>;
  status: "pending" | "running" | "success" | "failed" | "declined";
  created_at: string;
  completed_at: string | null;
}

export async function saveWorkflow(
  fetcher: AgentFetch,
  conversationId: string,
  name: string
): Promise<{ workflowId: string; steps: number; parameters: string[] }> {
  const res = await fetcher("/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, name }),
  });
  await throwIfNotOk(res, "Failed to save workflow");
  return res.json();
}

export async function listWorkflows(fetcher: AgentFetch) {
  const res = await fetcher("/workflows");
  await throwIfNotOk(res, "Failed to list workflows");
  return res.json() as Promise<WorkflowSummary[]>;
}

export async function getWorkflow(fetcher: AgentFetch, id: string) {
  const res = await fetcher(`/workflows/${id}`);
  await throwIfNotOk(res, "Failed to get workflow");
  return res.json() as Promise<WorkflowDetail>;
}

export async function listWorkflowRuns(fetcher: AgentFetch, workflowId: string) {
  const res = await fetcher(`/workflows/${workflowId}/runs`);
  await throwIfNotOk(res, "Failed to list workflow runs");
  return res.json() as Promise<WorkflowRunSummary[]>;
}

export async function* streamWorkflowRun(
  fetcher: AgentFetch,
  workflowId: string,
  inputs?: Record<string, unknown>
): AsyncGenerator<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetcher(`/workflows/${workflowId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: inputs ?? {} }),
    });
  } catch {
    throw new Error("Network error — check your connection");
  }

  await throwIfNotOk(res, "Failed to run workflow");

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
        try {
          yield JSON.parse(trimmed.slice(6));
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
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
