-- Workspace tables and helper functions
-- Every user gets a personal solo workspace on signup (see user_triggers.sql)
-- Teams create additional workspaces with membership_type = 'team'

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  membership_type public.workspace_membership_type DEFAULT 'solo' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspaces OWNER TO postgres;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);


-- Workspace settings (public-facing)
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_settings OWNER TO postgres;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;


-- Admin-only workspace settings
CREATE TABLE IF NOT EXISTS public.workspace_admin_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_admin_settings OWNER TO postgres;
ALTER TABLE public.workspace_admin_settings ENABLE ROW LEVEL SECURITY;


-- System-managed workspace settings
CREATE TABLE IF NOT EXISTS public.workspace_application_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_application_settings OWNER TO postgres;
ALTER TABLE public.workspace_application_settings ENABLE ROW LEVEL SECURITY;


-- Workspace members with RBAC roles
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_member_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  workspace_member_role public.workspace_member_role_type DEFAULT 'member' NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (workspace_id, workspace_member_id)
);

ALTER TABLE public.workspace_members OWNER TO postgres;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_member_id ON public.workspace_members(workspace_member_id);


-- Workspace invitations
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invitee_user_email TEXT NOT NULL,
  invitee_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invitee_user_role public.workspace_member_role_type DEFAULT 'member' NOT NULL,
  status public.workspace_invitation_link_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_invitations OWNER TO postgres;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspace_invitations_workspace_id ON public.workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_invitee_email ON public.workspace_invitations(invitee_user_email);


-- Workspace credits (e.g., AI usage allowance)
CREATE TABLE IF NOT EXISTS public.workspace_credits (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  workspace_id UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 12 NOT NULL
);

ALTER TABLE public.workspace_credits OWNER TO postgres;
ALTER TABLE public.workspace_credits ENABLE ROW LEVEL SECURITY;


-- Workspace credits audit log
CREATE TABLE IF NOT EXISTS public.workspace_credits_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  workspace_credits_id UUID NOT NULL REFERENCES public.workspace_credits(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  old_credits INTEGER,
  new_credits INTEGER
);

ALTER TABLE public.workspace_credits_logs OWNER TO postgres;
ALTER TABLE public.workspace_credits_logs ENABLE ROW LEVEL SECURITY;


-- Wire up user_settings.default_workspace now that workspaces table exists
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_default_workspace_fkey
  FOREIGN KEY (default_workspace) REFERENCES public.workspaces(id) ON DELETE SET NULL;


-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — hidden from anon/authenticated)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(user_id UUID, workspace_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_member_id = user_id
      AND workspace_members.workspace_id = is_workspace_member.workspace_id
  );
END;
$$;

ALTER FUNCTION public.is_workspace_member(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.is_workspace_member(UUID, UUID) TO service_role;


CREATE OR REPLACE FUNCTION public.is_workspace_admin(user_id UUID, workspace_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_member_id = user_id
      AND workspace_members.workspace_id = is_workspace_admin.workspace_id
      AND workspace_member_role IN ('admin', 'owner')
  );
END;
$$;

ALTER FUNCTION public.is_workspace_admin(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_workspace_admin(UUID, UUID) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.is_workspace_admin(UUID, UUID) TO service_role;


CREATE OR REPLACE FUNCTION public.get_workspace_team_member_ids(ws_id UUID)
RETURNS SETOF UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT workspace_member_id FROM public.workspace_members WHERE workspace_id = ws_id;
END;
$$;

ALTER FUNCTION public.get_workspace_team_member_ids(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_workspace_team_member_ids(UUID) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.get_workspace_team_member_ids(UUID) TO service_role;


CREATE OR REPLACE FUNCTION public.get_workspace_team_member_admins(ws_id UUID)
RETURNS SETOF UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT workspace_member_id FROM public.workspace_members
    WHERE workspace_id = ws_id AND workspace_member_role IN ('admin', 'owner');
END;
$$;

ALTER FUNCTION public.get_workspace_team_member_admins(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_workspace_team_member_admins(UUID) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.get_workspace_team_member_admins(UUID) TO service_role;


-- ============================================================
-- RLS POLICIES
-- ============================================================

CREATE POLICY "Workspace members can view their workspace" ON public.workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id AND workspace_member_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can update workspace" ON public.workspaces
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), id));

CREATE POLICY "Members can view workspace settings" ON public.workspace_settings
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can update workspace settings" ON public.workspace_settings
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can view admin settings" ON public.workspace_admin_settings
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can update admin settings" ON public.workspace_admin_settings
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage workspace members" ON public.workspace_members
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members can view workspace invitations" ON public.workspace_invitations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage invitations" ON public.workspace_invitations
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members can view workspace credits" ON public.workspace_credits
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can view credits logs" ON public.workspace_credits_logs
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));
