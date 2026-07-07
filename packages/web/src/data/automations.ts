"use server";

import { auth } from "@/lib/auth";
import { createClient } from "@/lib/server";
import type {
  Automation,
  AutomationDetail,
  InboxState,
  RunResult,
  WorkspaceInbox,
} from "./automations-types";

/**
 * Server actions for durable automations. Thin wrappers over the agent server's
 * /automations routes (service_role + workspace scoping live there), using
 * Foreman's standard web→agent pattern: authenticate, forward the user's Supabase
 * access token as a Bearer. Creation is chat-driven (the agent authors the durable
 * source), so there's no create action here — this surface manages existing ones.
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

async function accessToken(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const supabase = await createClient();
  const {
    data: { session: s },
  } = await supabase.auth.getSession();
  if (!s?.access_token) throw new Error("Unauthorized");
  return s.access_token;
}

async function agent<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `${init?.method ?? "GET"} ${path} → ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function getAutomations(): Promise<Automation[]> {
  const { automations } = await agent<{ automations: Automation[] }>("/automations");
  return automations;
}

export async function getAutomation(id: string): Promise<AutomationDetail> {
  return agent(`/automations/${id}`);
}

export async function getInboxState(id: string): Promise<InboxState> {
  return agent(`/automations/${id}/inbox`);
}

/** Workspace-wide aggregate inbox — every automation's inbox in one round-trip. */
export async function getWorkspaceInbox(): Promise<WorkspaceInbox> {
  return agent("/automations/inbox");
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<void> {
  await agent(`/automations/${id}`, { method: "PATCH", body: { enabled } });
}

export async function renameAutomation(id: string, name: string): Promise<void> {
  await agent(`/automations/${id}`, { method: "PATCH", body: { name } });
}

export async function runAutomation(id: string): Promise<RunResult> {
  return agent(`/automations/${id}/run`, { method: "POST", body: {} });
}

export async function deleteAutomation(id: string): Promise<void> {
  await agent(`/automations/${id}`, { method: "DELETE" });
}

/** Cancel a running durable run (foreman-y4kc). */
export async function cancelRun(runId: string): Promise<{ cancelled: boolean; status: string }> {
  return agent(`/automations/runs/${runId}/cancel`, { method: "POST", body: {} });
}

/** Approve/deny a durable human-approval gate (foreman-zfnj). Approve resumes with a
 * payload; deny (cancel:true) cancels the run. */
export async function respondToCallback(
  runId: string,
  input: { payload?: unknown; cancel?: boolean; callbackName?: string },
): Promise<{ ok: boolean; action: string; status?: number; reason?: string }> {
  return agent(`/automations/runs/${runId}/callback`, { method: "POST", body: input });
}
