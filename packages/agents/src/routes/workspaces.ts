import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getSupabase } from "@/lib/db";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Workspace management routes (multi-tenant step 5, foreman-c24s).
 *
 * Foreman's web client is RLS-scoped and CANNOT write the active-workspace
 * pointer (public."user".default_workspace_id lives on an RLS-locked,
 * service-role-only surface). It also can't see co-member profiles or act on
 * invitations as a not-yet-member invitee. So — matching Foreman's dominant
 * pattern (web → agent server via fetch, like /stored/agents and /dashboards) —
 * ALL workspace operations run here on the service_role client, with membership
 * and admin checks enforced in code.
 */
const workspaces = new Hono<AppEnv>();

workspaces.use("/*", authMiddleware);

const ADMIN_ROLES = new Set(["owner", "admin"]);
// owner is not assignable via UI. Tuple + type guard so a validated string
// narrows to the role union the DB columns expect (no cast at the write site).
const ASSIGNABLE_ROLES = ["admin", "member", "readonly"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
const isAssignableRole = (v: string): v is AssignableRole =>
  (ASSIGNABLE_ROLES as readonly string[]).includes(v);
const CONNECTION_MODES = new Set(["member-first", "shared", "personal"]);
const MAX_NAME_LEN = 120;

/** The caller's role in a workspace, or null if they're not a member. */
async function memberRole(workspaceId: string, userId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_member_role")
    .eq("workspace_id", workspaceId)
    .eq("workspace_member_id", userId)
    .maybeSingle();
  return (data?.workspace_member_role as string | undefined) ?? null;
}

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

/** The caller's email (for matching email-addressed invitations). */
async function callerEmail(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

// ─── My workspaces ───

// GET / — workspaces the caller belongs to, with their role + which is active.
workspaces.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabase();

  const [{ data: rows }, { data: principal }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_member_role, workspaces(id, slug, name, membership_type, created_at)")
      .eq("workspace_member_id", userId),
    supabase.from("user").select("default_workspace_id").eq("id", userId).maybeSingle(),
  ]);

  const activeId = (principal?.default_workspace_id as string | null) ?? null;
  const result = (rows ?? [])
    .map((r: any) => {
      const w = r.workspaces;
      if (!w) return null;
      return {
        id: w.id,
        slug: w.slug,
        name: w.name,
        membership_type: w.membership_type,
        role: r.workspace_member_role,
        is_active: w.id === activeId,
        created_at: w.created_at,
      };
    })
    .filter(Boolean);

  return c.json({ workspaces: result, active_workspace_id: activeId });
});

// POST / — create a team workspace and make the caller its owner.
workspaces.post("/", async (c) => {
  const userId = c.get("userId");
  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; setActive?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LEN) {
    return c.json({ error: "name is required (max 120 chars)" }, 400);
  }

  const supabase = getSupabase();
  const id = randomUUID();
  // companion rows (settings/credits) are created by the on_workspace_created trigger.
  const { error: wsErr } = await supabase
    .from("workspaces")
    .insert({ id, slug: slugify(name), name, membership_type: "team" });
  if (wsErr) return c.json({ error: `Failed to create workspace: ${wsErr.message}` }, 500);

  const { error: memErr } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: id, workspace_member_id: userId, workspace_member_role: "owner" });
  if (memErr) return c.json({ error: `Failed to add owner: ${memErr.message}` }, 500);

  if (body.setActive) {
    await supabase.from("user").update({ default_workspace_id: id }).eq("id", userId);
  }
  return c.json({ id, name }, 201);
});

// POST /switch — set the caller's active workspace (the agent reads
// user.default_workspace_id). Must be a member of the target.
workspaces.post("/switch", async (c) => {
  const userId = c.get("userId");
  const body = (await c.req.json().catch(() => ({}))) as { workspaceId?: unknown };
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!validateParam(workspaceId, "workspaceId")) {
    return c.json({ error: "workspaceId is required" }, 400);
  }
  if (!(await memberRole(workspaceId, userId))) {
    return c.json({ error: "Not a member of that workspace" }, 403);
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user")
    .update({ default_workspace_id: workspaceId })
    .eq("id", userId);
  if (error) return c.json({ error: `Failed to switch: ${error.message}` }, 500);
  return c.json({ active_workspace_id: workspaceId });
});

// ─── Invitee-side (the caller is the invitee, not yet a member) ───

// GET /invitations/mine — pending invitations addressed to the caller's email.
workspaces.get("/invitations/mine", async (c) => {
  const userId = c.get("userId");
  const email = await callerEmail(userId);
  if (!email) return c.json({ invitations: [] });
  const supabase = getSupabase();
  const { data } = await supabase
    .from("workspace_invitations")
    .select("id, invitee_user_role, created_at, workspaces(id, slug, name)")
    .eq("invitee_user_email", email)
    .eq("status", "pending");
  const invitations = (data ?? []).map((r: any) => ({
    id: r.id,
    role: r.invitee_user_role,
    created_at: r.created_at,
    workspace: r.workspaces
      ? { id: r.workspaces.id, slug: r.workspaces.slug, name: r.workspaces.name }
      : null,
  }));
  return c.json({ invitations });
});

// POST /invitations/:id/accept — accept; the DB trigger creates the membership.
workspaces.post("/invitations/:id/accept", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid invitation id" }, 400);
  const email = await callerEmail(userId);
  const supabase = getSupabase();

  const { data: inv } = await supabase
    .from("workspace_invitations")
    .select("id, invitee_user_email, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return c.json({ error: "Not found" }, 404);
  if (inv.status !== "pending") return c.json({ error: "Not found" }, 404);
  if (email && inv.invitee_user_email !== email)
    return c.json({ error: "Not your invitation" }, 403);

  // Set invitee_user_id THEN flip status — the accept trigger reads invitee_user_id.
  const { error } = await supabase
    .from("workspace_invitations")
    .update({
      invitee_user_id: userId,
      status: "finished_accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return c.json({ error: `Failed to accept: ${error.message}` }, 500);
  return c.json({ ok: true });
});

// POST /invitations/:id/decline
workspaces.post("/invitations/:id/decline", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid invitation id" }, 400);
  const email = await callerEmail(userId);
  const supabase = getSupabase();

  const { data: inv } = await supabase
    .from("workspace_invitations")
    .select("id, invitee_user_email, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return c.json({ error: "Not found" }, 404);
  if (inv.status !== "pending") return c.json({ error: "Not found" }, 404);
  if (email && inv.invitee_user_email !== email)
    return c.json({ error: "Not your invitation" }, 403);

  const { error } = await supabase
    .from("workspace_invitations")
    .update({
      invitee_user_id: userId,
      status: "finished_declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return c.json({ error: `Failed to decline: ${error.message}` }, 500);
  return c.json({ ok: true });
});

// ─── Per-workspace (membership/admin gated) ───

// GET /:id — workspace detail + the caller's role (members only).
workspaces.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role) return c.json({ error: "Not found" }, 404);
  const supabase = getSupabase();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, slug, name, membership_type, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!ws) return c.json({ error: "Not found" }, 404);
  return c.json({ ...ws, role });
});

// PATCH /:id — rename (admins only).
workspaces.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LEN)
    return c.json({ error: "name must be 1-120 chars" }, 400);

  const supabase = getSupabase();
  const { error } = await supabase.from("workspaces").update({ name }).eq("id", id);
  if (error) return c.json({ error: `Failed to update: ${error.message}` }, 500);
  return c.json({ id, name });
});

// DELETE /:id — delete the workspace (owner only; solo workspaces are not deletable here).
workspaces.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (role !== "owner") return c.json({ error: "Only the owner can delete a workspace" }, 403);

  const supabase = getSupabase();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("membership_type")
    .eq("id", id)
    .maybeSingle();
  if (ws?.membership_type === "solo") {
    return c.json({ error: "Cannot delete your personal workspace" }, 400);
  }

  // Repoint anyone whose active workspace is this one (FK is ON DELETE SET NULL,
  // but null active workspace degrades gracefully via resolveActiveWorkspace).
  await supabase.from("user").update({ default_workspace_id: null }).eq("default_workspace_id", id);
  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) return c.json({ error: `Failed to delete: ${error.message}` }, 500);
  return c.json({ ok: true });
});

// GET /:id/members — members with their profile (members only).
workspaces.get("/:id/members", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  if (!(await memberRole(id, userId))) return c.json({ error: "Not found" }, 404);

  const supabase = getSupabase();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_member_id, workspace_member_role, added_at, user_profiles(*)")
    .eq("workspace_id", id)
    .order("added_at", { ascending: true });
  const members = (data ?? []).map((m: any) => ({
    id: m.workspace_member_id,
    role: m.workspace_member_role,
    added_at: m.added_at,
    name: m.user_profiles?.full_name ?? null,
    avatar_url: m.user_profiles?.avatar_url ?? null,
    is_self: m.workspace_member_id === userId,
  }));
  return c.json({ members });
});

// PATCH /:id/members/:memberId — change a member's role (admins only).
workspaces.patch("/:id/members/:memberId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const memberId = validateParam(c.req.param("memberId"), "memberId");
  if (!id || !memberId) return c.json({ error: "Invalid id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { role?: unknown };
  const newRole = typeof body.role === "string" ? body.role : "";
  if (!isAssignableRole(newRole)) {
    return c.json({ error: "role must be one of admin, member, readonly" }, 400);
  }
  const target = await memberRole(id, memberId);
  if (target === "owner") return c.json({ error: "Cannot change the owner's role" }, 400);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("workspace_members")
    .update({ workspace_member_role: newRole })
    .eq("workspace_id", id)
    .eq("workspace_member_id", memberId);
  if (error) return c.json({ error: `Failed to update role: ${error.message}` }, 500);
  return c.json({ id: memberId, role: newRole });
});

// DELETE /:id/members/:memberId — remove a member (admins only; not the owner).
workspaces.delete("/:id/members/:memberId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const memberId = validateParam(c.req.param("memberId"), "memberId");
  if (!id || !memberId) return c.json({ error: "Invalid id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);
  if ((await memberRole(id, memberId)) === "owner") {
    return c.json({ error: "Cannot remove the owner" }, 400);
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", id)
    .eq("workspace_member_id", memberId);
  if (error) return c.json({ error: `Failed to remove: ${error.message}` }, 500);
  await supabase
    .from("user")
    .update({ default_workspace_id: null })
    .eq("id", memberId)
    .eq("default_workspace_id", id);
  return c.json({ ok: true });
});

// POST /:id/leave — the caller leaves the workspace (the owner cannot leave).
workspaces.post("/:id/leave", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role) return c.json({ error: "Not a member" }, 404);
  if (role === "owner")
    return c.json({ error: "The owner cannot leave; delete or transfer first" }, 400);

  const supabase = getSupabase();
  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", id)
    .eq("workspace_member_id", userId);
  await supabase
    .from("user")
    .update({ default_workspace_id: null })
    .eq("id", userId)
    .eq("default_workspace_id", id);
  return c.json({ ok: true });
});

// GET /:id/invitations — pending invitations for a workspace (admins only).
workspaces.get("/:id/invitations", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const supabase = getSupabase();
  const { data } = await supabase
    .from("workspace_invitations")
    .select("id, invitee_user_email, invitee_user_role, status, created_at")
    .eq("workspace_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return c.json({ invitations: data ?? [] });
});

// POST /:id/invitations — invite someone by email (admins only).
workspaces.post("/:id/invitations", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const inviteRole = typeof body.role === "string" ? body.role : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ error: "A valid email is required" }, 400);
  if (!isAssignableRole(inviteRole)) return c.json({ error: "Invalid role" }, 400);

  const supabase = getSupabase();
  // Don't duplicate an outstanding invite for the same email.
  const { data: existing } = await supabase
    .from("workspace_invitations")
    .select("id")
    .eq("workspace_id", id)
    .eq("invitee_user_email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return c.json({ error: "That email already has a pending invitation" }, 409);

  const invitationId = randomUUID();
  const { error } = await supabase.from("workspace_invitations").insert({
    id: invitationId,
    workspace_id: id,
    inviter_user_id: userId,
    invitee_user_email: email,
    invitee_user_role: inviteRole,
    status: "pending",
  });
  if (error) return c.json({ error: `Failed to invite: ${error.message}` }, 500);
  return c.json({ id: invitationId, email, role: inviteRole }, 201);
});

// DELETE /:id/invitations/:invId — revoke a pending invitation (admins only).
workspaces.delete("/:id/invitations/:invId", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  const invId = validateParam(c.req.param("invId"), "invId");
  if (!id || !invId) return c.json({ error: "Invalid id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invId)
    .eq("workspace_id", id);
  if (error) return c.json({ error: `Failed to revoke: ${error.message}` }, 500);
  return c.json({ ok: true });
});

// GET /:id/settings — workspace settings incl. the Zapier connection mode (members).
workspaces.get("/:id/settings", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  if (!(await memberRole(id, userId))) return c.json({ error: "Not found" }, 404);

  const supabase = getSupabase();
  const { data } = await supabase
    .from("workspace_settings")
    .select("zapier_connection_mode, updated_at")
    .eq("workspace_id", id)
    .maybeSingle();
  return c.json({
    zapier_connection_mode: (data?.zapier_connection_mode as string) ?? "member-first",
    updated_at: data?.updated_at ?? null,
  });
});

// PATCH /:id/settings — update the Zapier connection mode (admins only).
workspaces.patch("/:id/settings", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { zapier_connection_mode?: unknown };
  const mode = typeof body.zapier_connection_mode === "string" ? body.zapier_connection_mode : "";
  if (!CONNECTION_MODES.has(mode)) {
    return c.json({ error: "mode must be one of member-first, shared, personal" }, 400);
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("workspace_settings")
    .update({ zapier_connection_mode: mode, updated_at: new Date().toISOString() })
    .eq("workspace_id", id);
  if (error) return c.json({ error: `Failed to update settings: ${error.message}` }, 500);
  return c.json({ zapier_connection_mode: mode });
});

// ─── Shared Zapier connection (which connection "shared" mode resolves to) ───

// GET /:id/shared-connection — the workspace's designated connection (members),
// plus whether the caller has a personal connection they could designate.
workspaces.get("/:id/shared-connection", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  if (!(await memberRole(id, userId))) return c.json({ error: "Not found" }, 404);

  const supabase = getSupabase();
  const [{ data: shared }, { data: mine }] = await Promise.all([
    supabase.from("zapier_identity").select("user_id").eq("workspace_id", id).maybeSingle(),
    supabase.from("zapier_identity").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  return c.json({
    shared: shared ? { owner_id: shared.user_id, is_self: shared.user_id === userId } : null,
    caller_has_connection: Boolean(mine),
  });
});

// POST /:id/shared-connection — designate the caller's own Zapier connection as
// the workspace's shared one (admins only). Tags zapier_identity.workspace_id,
// which getSdkForUser resolves for "shared"/"member-first" modes.
workspaces.post("/:id/shared-connection", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);

  const supabase = getSupabase();
  const { data: mine } = await supabase
    .from("zapier_identity")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!mine) return c.json({ error: "Connect your own Zapier account first" }, 400);

  // Exactly one designated connection per workspace: clear the prior one, then tag the caller's.
  await supabase.from("zapier_identity").update({ workspace_id: null }).eq("workspace_id", id);
  const { error } = await supabase
    .from("zapier_identity")
    .update({ workspace_id: id })
    .eq("user_id", userId);
  if (error) return c.json({ error: `Failed: ${error.message}` }, 500);
  return c.json({ ok: true });
});

// DELETE /:id/shared-connection — clear the workspace's designated connection (admins only).
workspaces.delete("/:id/shared-connection", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) return c.json({ error: "Invalid workspace id" }, 400);
  const role = await memberRole(id, userId);
  if (!role || !ADMIN_ROLES.has(role)) return c.json({ error: "Admins only" }, 403);
  const supabase = getSupabase();
  await supabase.from("zapier_identity").update({ workspace_id: null }).eq("workspace_id", id);
  return c.json({ ok: true });
});

export default workspaces;
