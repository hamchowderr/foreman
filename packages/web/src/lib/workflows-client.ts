/**
 * Typed client for /workflows/* routes on the agents server.
 *
 * Server components pass a Supabase access token; client components rely on
 * a route handler that injects the same token. The shapes here mirror the
 * Hono routes in packages/agents/src/routes/workflows.ts.
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export interface WorkflowSummary {
  id: string;
  name: string;
  source_conversation_id: string | null;
  parameters: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  order: number;
  proposal_template: {
    app_key?: string;
    action_key?: string;
    human_label?: string;
    inputs?: Record<string, unknown>;
  };
}

export interface WorkflowDetail {
  workflow: WorkflowSummary;
  steps: WorkflowStep[];
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  inputs: Record<string, string>;
  status: "running" | "success" | "error";
  created_at: string;
  completed_at: string | null;
}

export interface WorkflowTrigger {
  id: string;
  type: "cron" | "channel" | "poll";
  enabled: boolean;
  config: Record<string, unknown>;
  last_fired_at: string | null;
}

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export function listWorkflows(token: string) {
  return request<WorkflowSummary[]>("/workflows", token);
}

export function getWorkflow(id: string, token: string) {
  return request<WorkflowDetail>(`/workflows/${id}`, token);
}

export function listRuns(id: string, token: string) {
  return request<WorkflowRun[]>(`/workflows/${id}/runs`, token);
}

export function listTriggers(id: string, token: string) {
  return request<{ triggers: WorkflowTrigger[] }>(`/workflows/${id}/triggers`, token);
}

export function renameWorkflow(id: string, name: string, token: string) {
  return request<{ ok: true; id: string; name: string }>(`/workflows/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteWorkflow(id: string, token: string) {
  return request<{ ok: true; id: string }>(`/workflows/${id}`, token, { method: "DELETE" });
}

export function setTriggerEnabled(
  workflowId: string,
  triggerId: string,
  enabled: boolean,
  token: string,
) {
  return request<{ ok: true; id: string; enabled: boolean }>(
    `/workflows/${workflowId}/triggers/${triggerId}`,
    token,
    { method: "PATCH", body: JSON.stringify({ enabled }) },
  );
}

export function detachTrigger(workflowId: string, triggerId: string, token: string) {
  return request<{ ok: true; id: string }>(
    `/workflows/${workflowId}/triggers/${triggerId}`,
    token,
    { method: "DELETE" },
  );
}
