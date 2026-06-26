/**
 * Shared types for the workspace data layer. Kept out of the "use server"
 * module (data/workspaces.ts) because a "use server" file may only export
 * async functions.
 */

export type WorkspaceRole = "owner" | "admin" | "member" | "readonly";

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  membership_type: "solo" | "team";
  role: WorkspaceRole;
  is_active: boolean;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  role: WorkspaceRole;
  added_at: string;
  name: string | null;
  avatar_url: string | null;
  is_self: boolean;
}

export interface WorkspaceInvitation {
  id: string;
  invitee_user_email: string;
  invitee_user_role: WorkspaceRole;
  status: string;
  created_at: string;
}

export interface MyInvitation {
  id: string;
  role: WorkspaceRole;
  created_at: string;
  workspace: { id: string; slug: string; name: string } | null;
}

export type ConnectionMode = "member-first" | "shared" | "personal";
