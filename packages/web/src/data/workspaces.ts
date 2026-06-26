"use server";

import { auth } from "@/lib/auth";
import { createClient } from "@/lib/server";
import type {
  ConnectionMode,
  MyInvitation,
  SharedConnectionInfo,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from "./workspaces-types";

/**
 * Server actions for workspace management. Thin wrappers over the agent server's
 * /workspaces routes (service_role + membership/admin checks live there), using
 * Foreman's standard web→agent pattern: authenticate, forward the user's Supabase
 * access token as a Bearer. Callable from both server components and client
 * components.
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

// ─── My workspaces / switching ───

export async function getMyWorkspaces(): Promise<{
  workspaces: WorkspaceSummary[];
  active_workspace_id: string | null;
}> {
  return agent("/workspaces");
}

export async function switchWorkspace(workspaceId: string): Promise<void> {
  await agent("/workspaces/switch", { method: "POST", body: { workspaceId } });
}

export async function createWorkspace(name: string, setActive = true): Promise<{ id: string }> {
  return agent("/workspaces", { method: "POST", body: { name, setActive } });
}

export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceSummary[]> {
  const { workspaces } = await getMyWorkspaces();
  return workspaces.filter((w) => w.slug === slug);
}

// ─── A workspace ───

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}`, { method: "PATCH", body: { name } });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}`, { method: "DELETE" });
}

// ─── Members ───

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { members } = await agent<{ members: WorkspaceMember[] }>(
    `/workspaces/${workspaceId}/members`,
  );
  return members;
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<void> {
  await agent(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeMember(workspaceId: string, memberId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}/leave`, { method: "POST" });
}

// ─── Invitations (admin side) ───

export async function getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const { invitations } = await agent<{ invitations: WorkspaceInvitation[] }>(
    `/workspaces/${workspaceId}/invitations`,
  );
  return invitations;
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
): Promise<void> {
  await agent(`/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    body: { email, role },
  });
}

export async function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" });
}

// ─── Invitations (invitee side) ───

export async function getMyInvitations(): Promise<MyInvitation[]> {
  const { invitations } = await agent<{ invitations: MyInvitation[] }>(
    "/workspaces/invitations/mine",
  );
  return invitations;
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  await agent(`/workspaces/invitations/${invitationId}/accept`, { method: "POST" });
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await agent(`/workspaces/invitations/${invitationId}/decline`, { method: "POST" });
}

// ─── Settings ───

export async function getWorkspaceSettings(
  workspaceId: string,
): Promise<{ zapier_connection_mode: ConnectionMode }> {
  return agent(`/workspaces/${workspaceId}/settings`);
}

export async function setConnectionMode(workspaceId: string, mode: ConnectionMode): Promise<void> {
  await agent(`/workspaces/${workspaceId}/settings`, {
    method: "PATCH",
    body: { zapier_connection_mode: mode },
  });
}

export async function getSharedConnection(workspaceId: string): Promise<SharedConnectionInfo> {
  return agent(`/workspaces/${workspaceId}/shared-connection`);
}

export async function shareMyConnection(workspaceId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}/shared-connection`, { method: "POST" });
}

export async function clearSharedConnection(workspaceId: string): Promise<void> {
  await agent(`/workspaces/${workspaceId}/shared-connection`, { method: "DELETE" });
}
