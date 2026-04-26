-- Foreman multi-tenant migration
-- Adds workspaces, billing, marketing (blog/changelog/feedback), and user profile tables
-- Renames org_id → workspace_id on conversation, channel_identity, zapier_identity

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- ENUMS
-- ============================================================

-- User-level role for app admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Workspace membership classification
CREATE TYPE public.workspace_membership_type AS ENUM ('solo', 'team');

-- RBAC roles within a workspace
CREATE TYPE public.workspace_member_role_type AS ENUM ('owner', 'admin', 'member', 'readonly');

-- Invitation lifecycle
CREATE TYPE public.workspace_invitation_link_status AS ENUM (
  'pending',
  'finished_accepted',
  'finished_declined',
  'expired'
);

-- Billing / subscription
CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
  'paused'
);

CREATE TYPE public.pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

-- Marketing feedback
CREATE TYPE public.marketing_blog_post_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.marketing_changelog_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.marketing_feedback_thread_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.marketing_feedback_thread_status AS ENUM ('open', 'under_review', 'planned', 'in_progress', 'completed', 'closed');
CREATE TYPE public.marketing_feedback_thread_type AS ENUM ('feature_request', 'bug', 'improvement', 'question', 'other');
CREATE TYPE public.marketing_feedback_moderator_hold_category AS ENUM ('spam', 'duplicate', 'off_topic', 'inappropriate', 'other');
CREATE TYPE public.marketing_feedback_reaction_type AS ENUM ('like', 'heart', 'celebrate', 'upvote');

-- ============================================================
-- USER PROFILE TABLES
-- ============================================================

-- Richer user profile, linked to auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.user_profiles OWNER TO postgres;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Per-user settings (default_workspace pointer)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  default_workspace UUID
);

ALTER TABLE public.user_settings OWNER TO postgres;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Email mirror for fast querying without touching auth.users
CREATE TABLE IF NOT EXISTS public.user_application_settings (
  id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email TEXT
);

ALTER TABLE public.user_application_settings OWNER TO postgres;
ALTER TABLE public.user_application_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own application settings" ON public.user_application_settings
  FOR SELECT USING (auth.uid() = id);

-- App-level role assignments (admin vs normal user)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user'
);

ALTER TABLE public.user_roles OWNER TO postgres;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

CREATE POLICY "Users can read their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Admins granted access by custom_access_token_hook
REVOKE ALL ON TABLE public.user_roles FROM authenticated, anon;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;

-- In-app notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  is_seen BOOLEAN DEFAULT FALSE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.user_notifications OWNER TO postgres;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);

CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Add to realtime publication so clients get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Account deletion tokens
CREATE TABLE IF NOT EXISTS public.account_delete_tokens (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.account_delete_tokens OWNER TO postgres;
ALTER TABLE public.account_delete_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_account_delete_tokens_user_id ON public.account_delete_tokens(user_id);

CREATE POLICY "Users can manage their own delete tokens" ON public.account_delete_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WORKSPACE TABLES
-- ============================================================

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

-- Workspace admin-only settings
CREATE TABLE IF NOT EXISTS public.workspace_admin_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_admin_settings OWNER TO postgres;
ALTER TABLE public.workspace_admin_settings ENABLE ROW LEVEL SECURITY;

-- Workspace application settings (system-managed)
CREATE TABLE IF NOT EXISTS public.workspace_application_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.workspace_application_settings OWNER TO postgres;
ALTER TABLE public.workspace_application_settings ENABLE ROW LEVEL SECURITY;

-- Workspace members (RBAC)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_member_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  workspace_member_role public.workspace_member_role_type DEFAULT 'member' NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{
    "view_members": true,
    "edit_members": true,
    "delete_members": true,
    "view_billing": true,
    "manage_billing": true,
    "view_projects": true,
    "add_projects": true,
    "edit_projects": true,
    "delete_projects": true,
    "view_settings": true,
    "edit_settings": true
  }'::jsonb,
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

-- Workspace credits
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

-- FK from user_settings to workspaces (deferred — workspaces must exist first)
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_default_workspace_fkey
  FOREIGN KEY (default_workspace) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- ============================================================
-- WORKSPACE HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(user_id UUID, workspace_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_member_id = user_id AND workspace_members.workspace_id = is_workspace_member.workspace_id
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

-- Check granular permission
CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  user_id UUID,
  workspace_id UUID,
  permission TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_member_id = user_id
      AND workspace_members.workspace_id = has_workspace_permission.workspace_id
      AND workspace_member_role IN ('admin', 'owner')
  ) THEN RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_member_id = user_id
      AND workspace_members.workspace_id = has_workspace_permission.workspace_id
      AND permissions->>permission = 'true'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workspace_member_permissions(
  member_id UUID,
  workspace_id UUID,
  new_permissions JSONB
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), workspace_id) THEN
    RAISE EXCEPTION 'Only workspace admins can modify permissions';
  END IF;
  UPDATE workspace_members
  SET permissions = new_permissions
  WHERE workspace_member_id = member_id
    AND workspace_members.workspace_id = update_workspace_member_permissions.workspace_id
    AND workspace_member_role NOT IN ('admin', 'owner');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or cannot modify admin/owner permissions';
  END IF;
END;
$$;

-- ============================================================
-- WORKSPACE RLS POLICIES
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

-- ============================================================
-- WORKSPACE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_workspace_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.workspace_settings (workspace_id) VALUES (NEW.id);
  INSERT INTO public.workspace_admin_settings (workspace_id) VALUES (NEW.id);
  INSERT INTO public.workspace_application_settings (workspace_id) VALUES (NEW.id);
  INSERT INTO public.workspace_credits (workspace_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_workspace_created() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_workspace_created() FROM anon, authenticated;
GRANT ALL ON FUNCTION public.handle_workspace_created() TO service_role;

CREATE OR REPLACE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_created();

CREATE OR REPLACE FUNCTION public.handle_add_workspace_member_after_invitation_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO workspace_members (workspace_member_id, workspace_member_role, workspace_id)
  VALUES (NEW.invitee_user_id, NEW.invitee_user_role, NEW.workspace_id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_add_workspace_member_after_invitation_accepted() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_add_workspace_member_after_invitation_accepted() FROM anon, authenticated;
GRANT ALL ON FUNCTION public.handle_add_workspace_member_after_invitation_accepted() TO service_role;

CREATE OR REPLACE TRIGGER on_workspace_invitation_accepted_trigger
  AFTER UPDATE ON public.workspace_invitations
  FOR EACH ROW
  WHEN (OLD.status <> NEW.status AND NEW.status = 'finished_accepted')
  EXECUTE FUNCTION public.handle_add_workspace_member_after_invitation_accepted();

CREATE OR REPLACE FUNCTION public.log_workspace_credits_changes()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO workspace_credits_logs (workspace_credits_id, workspace_id, change_type, changed_at, old_credits, new_credits)
    VALUES (NEW.id, NEW.workspace_id, 'UPDATE', NOW(), OLD.credits, NEW.credits);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO workspace_credits_logs (workspace_credits_id, workspace_id, change_type, changed_at, new_credits)
    VALUES (NEW.id, NEW.workspace_id, 'INSERT', NOW(), NEW.credits);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER workspace_credits_changes_trigger
  AFTER INSERT OR UPDATE ON public.workspace_credits
  FOR EACH ROW EXECUTE FUNCTION public.log_workspace_credits_changes();

-- ============================================================
-- USER TRIGGERS (auto-provision on auth.users INSERT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  new_workspace_id UUID;
  workspace_slug TEXT;
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Mirror email for fast lookups
  INSERT INTO public.user_application_settings (id, email)
  VALUES (NEW.id, NEW.email);

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Create a personal solo workspace
  workspace_slug := LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), '[^a-z0-9]', '-', 'g'))
    || '-' || SUBSTRING(NEW.id::text, 1, 8);

  INSERT INTO public.workspaces (slug, name, membership_type)
  VALUES (workspace_slug, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace', 'solo')
  RETURNING id INTO new_workspace_id;

  -- Make user the owner of their workspace
  INSERT INTO public.workspace_members (workspace_id, workspace_member_id, workspace_member_role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Point user settings at their new default workspace
  INSERT INTO public.user_settings (id, default_workspace)
  VALUES (NEW.id, new_workspace_id);

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_auth_user_created() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_auth_user_created() FROM anon, authenticated;
GRANT ALL ON FUNCTION public.handle_auth_user_created() TO service_role;

CREATE OR REPLACE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- Sync email changes to user_application_settings
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.user_application_settings
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_auth_user_email_updated() OWNER TO postgres;

CREATE OR REPLACE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_updated();

-- Welcome notification
CREATE OR REPLACE FUNCTION public.handle_auth_user_created_welcome_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, payload)
  VALUES (NEW.id, '{"type": "welcome", "message": "Welcome to Foreman! Your AI automation assistant is ready."}'::jsonb);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_auth_user_created_welcome_notification() OWNER TO postgres;

CREATE OR REPLACE TRIGGER on_auth_user_created_create_welcome_notification
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created_welcome_notification();

-- ============================================================
-- CUSTOM ACCESS TOKEN HOOK (injects user_role into JWT claims)
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  claims jsonb;
  user_role public.app_role;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', 'null');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon;

-- ============================================================
-- IS APPLICATION ADMIN HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_application_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND role = 'admin'
  );
END;
$$;

ALTER FUNCTION public.is_application_admin(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_application_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_application_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_application_admin(UUID) TO service_role;

-- ============================================================
-- BILLING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_products OWNER TO postgres;
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.billing_products
  FOR SELECT USING (is_active = TRUE);

CREATE TABLE IF NOT EXISTS public.billing_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.billing_products(id) ON DELETE CASCADE,
  unit_amount BIGINT,
  currency TEXT NOT NULL DEFAULT 'usd',
  recurring_interval public.pricing_plan_interval,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  free_trial_days INTEGER DEFAULT 0,
  tier TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_prices OWNER TO postgres;
ALTER TABLE public.billing_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active prices" ON public.billing_prices
  FOR SELECT USING (is_active = TRUE);

CREATE TABLE IF NOT EXISTS public.billing_volume_tiers (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  price_id TEXT NOT NULL REFERENCES public.billing_prices(id) ON DELETE CASCADE,
  up_to BIGINT,
  unit_amount BIGINT,
  flat_amount BIGINT
);

ALTER TABLE public.billing_volume_tiers OWNER TO postgres;
ALTER TABLE public.billing_volume_tiers ENABLE ROW LEVEL SECURITY;

-- One billing customer per workspace per gateway
CREATE TABLE IF NOT EXISTS public.billing_customers (
  gateway_customer_id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_name TEXT NOT NULL DEFAULT 'stripe',
  billing_email TEXT
);

ALTER TABLE public.billing_customers OWNER TO postgres;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_customers_workspace_id ON public.billing_customers(workspace_id);

CREATE POLICY "Workspace admins can view billing customers" ON public.billing_customers
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT NOT NULL REFERENCES public.billing_customers(gateway_customer_id) ON DELETE CASCADE,
  price_id TEXT REFERENCES public.billing_prices(id),
  status public.subscription_status NOT NULL,
  is_trial BOOLEAN DEFAULT FALSE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_subscriptions OWNER TO postgres;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_subscriptions_workspace_id ON public.billing_subscriptions(workspace_id);

CREATE POLICY "Workspace admins can view subscriptions" ON public.billing_subscriptions
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  subscription_id TEXT REFERENCES public.billing_subscriptions(id),
  amount_due BIGINT NOT NULL DEFAULT 0,
  amount_paid BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_invoices OWNER TO postgres;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_invoices_workspace_id ON public.billing_invoices(workspace_id);

CREATE POLICY "Workspace admins can view invoices" ON public.billing_invoices
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.billing_one_time_payments (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_one_time_payments OWNER TO postgres;
ALTER TABLE public.billing_one_time_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_one_time_payments_workspace_id ON public.billing_one_time_payments(workspace_id);

CREATE POLICY "Workspace admins can view one-time payments" ON public.billing_one_time_payments
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.billing_payment_methods (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  type TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_payment_methods OWNER TO postgres;
ALTER TABLE public.billing_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_payment_methods_workspace_id ON public.billing_payment_methods(workspace_id);

CREATE POLICY "Workspace admins can view payment methods" ON public.billing_payment_methods
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can manage payment methods" ON public.billing_payment_methods
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.billing_usage_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES public.billing_subscriptions(id),
  metric TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_usage_logs OWNER TO postgres;
ALTER TABLE public.billing_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_usage_logs_workspace_id ON public.billing_usage_logs(workspace_id);

CREATE POLICY "Workspace admins can view usage logs" ON public.billing_usage_logs
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Helper to resolve workspace from gateway customer
CREATE OR REPLACE FUNCTION public.get_customer_workspace_id(customer_id TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ws_id UUID;
BEGIN
  SELECT workspace_id INTO ws_id FROM public.billing_customers WHERE gateway_customer_id = customer_id;
  RETURN ws_id;
END;
$$;

ALTER FUNCTION public.get_customer_workspace_id(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_customer_workspace_id(TEXT) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.get_customer_workspace_id(TEXT) TO service_role;

-- ============================================================
-- MARKETING — AUTHOR PROFILES & TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_author_profiles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  twitter_handle TEXT,
  github_handle TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_author_profiles OWNER TO postgres;
ALTER TABLE public.marketing_author_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view author profiles" ON public.marketing_author_profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage author profiles" ON public.marketing_author_profiles
  FOR ALL USING (public.is_application_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_tags (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_tags OWNER TO postgres;
ALTER TABLE public.marketing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON public.marketing_tags
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage tags" ON public.marketing_tags
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- ============================================================
-- MARKETING — BLOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_blog_posts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  json_content JSONB,
  status public.marketing_blog_post_status DEFAULT 'draft' NOT NULL,
  cover_image TEXT,
  media_type VARCHAR CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'gif')),
  seo_data JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_blog_posts OWNER TO postgres;
ALTER TABLE public.marketing_blog_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_blog_posts_status ON public.marketing_blog_posts(status);
CREATE INDEX idx_marketing_blog_posts_slug ON public.marketing_blog_posts(slug);

CREATE POLICY "Anyone can view published blog posts" ON public.marketing_blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all blog posts" ON public.marketing_blog_posts
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- Blog post ↔ tag relationship
CREATE TABLE IF NOT EXISTS public.marketing_blog_post_tags_relationship (
  blog_post_id UUID NOT NULL REFERENCES public.marketing_blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.marketing_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, tag_id)
);

ALTER TABLE public.marketing_blog_post_tags_relationship OWNER TO postgres;
ALTER TABLE public.marketing_blog_post_tags_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog post tags" ON public.marketing_blog_post_tags_relationship
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage blog post tags" ON public.marketing_blog_post_tags_relationship
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- Blog post ↔ author relationship
CREATE TABLE IF NOT EXISTS public.marketing_blog_author_posts (
  blog_post_id UUID NOT NULL REFERENCES public.marketing_blog_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.marketing_author_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, author_id)
);

ALTER TABLE public.marketing_blog_author_posts OWNER TO postgres;
ALTER TABLE public.marketing_blog_author_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog post authors" ON public.marketing_blog_author_posts
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage blog post authors" ON public.marketing_blog_author_posts
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- ============================================================
-- MARKETING — CHANGELOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_changelog (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  title TEXT NOT NULL,
  json_content JSONB,
  content TEXT,
  cover_image TEXT,
  media_type VARCHAR(20) CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'gif')),
  media_url TEXT,
  media_alt TEXT,
  video_poster TEXT,
  version VARCHAR(20),
  tags TEXT[] DEFAULT '{}',
  technical_details TEXT,
  status public.marketing_changelog_status DEFAULT 'draft' NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_changelog OWNER TO postgres;
ALTER TABLE public.marketing_changelog ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_changelog_status ON public.marketing_changelog(status);
CREATE INDEX idx_marketing_changelog_tags ON public.marketing_changelog USING GIN (tags);
CREATE INDEX idx_marketing_changelog_version ON public.marketing_changelog (version);

CREATE POLICY "Anyone can view published changelog entries" ON public.marketing_changelog
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all changelog entries" ON public.marketing_changelog
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- Changelog ↔ author relationship
CREATE TABLE IF NOT EXISTS public.marketing_changelog_author_relationship (
  changelog_id UUID NOT NULL REFERENCES public.marketing_changelog(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.marketing_author_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (changelog_id, author_id)
);

ALTER TABLE public.marketing_changelog_author_relationship OWNER TO postgres;
ALTER TABLE public.marketing_changelog_author_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changelog authors" ON public.marketing_changelog_author_relationship
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage changelog authors" ON public.marketing_changelog_author_relationship
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- ============================================================
-- MARKETING — FEEDBACK
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_feedback_boards (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_boards OWNER TO postgres;
ALTER TABLE public.marketing_feedback_boards ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_feedback_boards_created_by ON public.marketing_feedback_boards(created_by);

CREATE POLICY "Public boards are viewable by everyone" ON public.marketing_feedback_boards
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage boards" ON public.marketing_feedback_boards
  FOR ALL USING (public.is_application_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_feedback_threads (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  board_id UUID DEFAULT NULL REFERENCES public.marketing_feedback_boards(id) ON DELETE CASCADE,
  priority public.marketing_feedback_thread_priority DEFAULT 'medium' NOT NULL,
  type public.marketing_feedback_thread_type DEFAULT 'feature_request' NOT NULL,
  status public.marketing_feedback_thread_status DEFAULT 'open' NOT NULL,
  added_to_roadmap BOOLEAN DEFAULT FALSE NOT NULL,
  open_for_public_discussion BOOLEAN DEFAULT TRUE NOT NULL,
  is_publicly_visible BOOLEAN DEFAULT TRUE NOT NULL,
  moderator_hold_category public.marketing_feedback_moderator_hold_category DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_threads OWNER TO postgres;
ALTER TABLE public.marketing_feedback_threads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_feedback_threads_user_id ON public.marketing_feedback_threads(user_id);
CREATE INDEX idx_marketing_feedback_threads_board_id ON public.marketing_feedback_threads(board_id);
CREATE INDEX idx_marketing_feedback_threads_status ON public.marketing_feedback_threads(status);

CREATE POLICY "Anyone can view public feedback threads" ON public.marketing_feedback_threads
  FOR SELECT USING (is_publicly_visible = TRUE);

CREATE POLICY "Users can submit feedback" ON public.marketing_feedback_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.marketing_feedback_threads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all feedback threads" ON public.marketing_feedback_threads
  FOR ALL USING (public.is_application_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_feedback_comments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  thread_id UUID NOT NULL REFERENCES public.marketing_feedback_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_publicly_visible BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_comments OWNER TO postgres;
ALTER TABLE public.marketing_feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_feedback_comments_thread_id ON public.marketing_feedback_comments(thread_id);
CREATE INDEX idx_marketing_feedback_comments_user_id ON public.marketing_feedback_comments(user_id);

CREATE POLICY "Anyone can view public feedback comments" ON public.marketing_feedback_comments
  FOR SELECT USING (is_publicly_visible = TRUE);

CREATE POLICY "Users can add comments" ON public.marketing_feedback_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.marketing_feedback_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments" ON public.marketing_feedback_comments
  FOR ALL USING (public.is_application_admin(auth.uid()));

-- Feedback reactions
CREATE TABLE IF NOT EXISTS public.marketing_feedback_thread_reactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  thread_id UUID NOT NULL REFERENCES public.marketing_feedback_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reaction_type public.marketing_feedback_reaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_thread_reactions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_thread_reactions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_thread_user_reaction ON public.marketing_feedback_thread_reactions(thread_id, user_id, reaction_type);
CREATE INDEX idx_marketing_feedback_thread_reactions_thread_id ON public.marketing_feedback_thread_reactions(thread_id);

CREATE POLICY "Users can view all thread reactions" ON public.marketing_feedback_thread_reactions
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can add their own reactions" ON public.marketing_feedback_thread_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions" ON public.marketing_feedback_thread_reactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.marketing_feedback_comment_reactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  comment_id UUID NOT NULL REFERENCES public.marketing_feedback_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reaction_type public.marketing_feedback_reaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_comment_reactions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_comment_user_reaction ON public.marketing_feedback_comment_reactions(comment_id, user_id, reaction_type);
CREATE INDEX idx_marketing_feedback_comment_reactions_comment_id ON public.marketing_feedback_comment_reactions(comment_id);

CREATE POLICY "Users can view all comment reactions" ON public.marketing_feedback_comment_reactions
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can add their own comment reactions" ON public.marketing_feedback_comment_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own comment reactions" ON public.marketing_feedback_comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Feedback subscriptions
CREATE TABLE IF NOT EXISTS public.marketing_feedback_board_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.marketing_feedback_boards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_board_subscriptions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_board_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_board_subscription ON public.marketing_feedback_board_subscriptions(user_id, board_id);
CREATE INDEX idx_marketing_feedback_board_subscriptions_user_id ON public.marketing_feedback_board_subscriptions(user_id);

CREATE POLICY "Users can view their own board subscriptions" ON public.marketing_feedback_board_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own board subscriptions" ON public.marketing_feedback_board_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.marketing_feedback_thread_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.marketing_feedback_threads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_thread_subscriptions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_thread_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_thread_subscription ON public.marketing_feedback_thread_subscriptions(user_id, thread_id);
CREATE INDEX idx_marketing_feedback_thread_subscriptions_user_id ON public.marketing_feedback_thread_subscriptions(user_id);

CREATE POLICY "Users can view their own thread subscriptions" ON public.marketing_feedback_thread_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own thread subscriptions" ON public.marketing_feedback_thread_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- APP SETTINGS (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT single_row CHECK (id)
);

ALTER TABLE public.app_settings OWNER TO postgres;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.is_application_admin(auth.uid()));

CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_application_admin(auth.uid()))
  WITH CHECK (public.is_application_admin(auth.uid()));

-- ============================================================
-- MIGRATE org_id → workspace_id ON EXISTING TABLES
-- Drop the old text columns and add new UUID columns
-- (No FK constraint on existing rows — nulls are fine for
--  rows created before this migration; app code now assigns
--  workspace_id on new rows.)
-- ============================================================

-- conversation
ALTER TABLE public.conversation
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_conversation_workspace_id ON public.conversation(workspace_id);

-- channel_identity
ALTER TABLE public.channel_identity
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_channel_identity_workspace_id ON public.channel_identity(workspace_id);

-- zapier_identity
ALTER TABLE public.zapier_identity
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_zapier_identity_workspace_id ON public.zapier_identity(workspace_id);

-- ============================================================
-- ADMIN ANALYTICS FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.app_admin_get_total_user_count()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE user_count INTEGER;
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  RETURN user_count;
END;
$$;

ALTER FUNCTION public.app_admin_get_total_user_count() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_total_user_count() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_get_total_workspace_count()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE ws_count INTEGER;
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT COUNT(*) INTO ws_count FROM public.workspaces;
  RETURN ws_count;
END;
$$;

ALTER FUNCTION public.app_admin_get_total_workspace_count() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_total_workspace_count() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_get_recent_30_day_signin_count()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE signin_count INTEGER;
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT COUNT(*) INTO signin_count FROM auth.users WHERE last_sign_in_at >= CURRENT_DATE - INTERVAL '30 DAYS';
  RETURN signin_count;
END;
$$;

ALTER FUNCTION public.app_admin_get_recent_30_day_signin_count() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_recent_30_day_signin_count() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_get_workspaces_created_per_month()
RETURNS TABLE(month DATE, number_of_workspaces INTEGER) LANGUAGE plpgsql AS $$
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
    WITH date_series AS (
      SELECT DATE_TRUNC('MONTH', dd)::DATE AS month
      FROM generate_series(
        DATE_TRUNC('MONTH', CURRENT_DATE - INTERVAL '1 YEAR'),
        DATE_TRUNC('MONTH', CURRENT_DATE),
        '1 MONTH'::INTERVAL
      ) dd
    ),
    ws_counts AS (
      SELECT DATE_TRUNC('MONTH', created_at)::DATE AS month, COUNT(*)::INTEGER AS cnt
      FROM public.workspaces
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 YEAR'
      GROUP BY 1
    )
    SELECT date_series.month, COALESCE(ws_counts.cnt, 0)
    FROM date_series LEFT JOIN ws_counts USING (month)
    ORDER BY date_series.month;
END;
$$;

ALTER FUNCTION public.app_admin_get_workspaces_created_per_month() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_workspaces_created_per_month() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_get_users_created_per_month()
RETURNS TABLE(month DATE, number_of_users INTEGER) LANGUAGE plpgsql AS $$
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
    WITH date_series AS (
      SELECT DATE_TRUNC('MONTH', dd)::DATE AS month
      FROM generate_series(
        DATE_TRUNC('MONTH', CURRENT_DATE - INTERVAL '1 YEAR'),
        DATE_TRUNC('MONTH', CURRENT_DATE),
        '1 MONTH'::INTERVAL
      ) dd
    ),
    user_counts AS (
      SELECT DATE_TRUNC('MONTH', created_at)::DATE AS month, COUNT(*)::INTEGER AS cnt
      FROM public.user_profiles
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 YEAR'
      GROUP BY 1
    )
    SELECT date_series.month, COALESCE(user_counts.cnt, 0)
    FROM date_series LEFT JOIN user_counts USING (month)
    ORDER BY date_series.month;
END;
$$;

ALTER FUNCTION public.app_admin_get_users_created_per_month() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_users_created_per_month() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_get_user_id_by_email(emailarg TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  IF CURRENT_ROLE NOT IN ('service_role', 'supabase_admin', 'dashboard_user', 'postgres') THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(emailarg);
  RETURN v_user_id;
END;
$$;

ALTER FUNCTION public.app_admin_get_user_id_by_email(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.app_admin_get_user_id_by_email(TEXT) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_if_authenticated_user_owns_email(email VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE (auth.users.email = $1 OR LOWER(auth.users.email) = LOWER($1))
      AND id = auth.uid()
  );
END;
$_$;

ALTER FUNCTION public.check_if_authenticated_user_owns_email(VARCHAR) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_if_authenticated_user_owns_email(VARCHAR) FROM anon, authenticated;

-- Decrement workspace credits helper
CREATE OR REPLACE FUNCTION public.decrement_workspace_credits(ws_id UUID, amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.workspace_credits SET credits = credits - amount WHERE workspace_id = ws_id;
END;
$$;

ALTER FUNCTION public.decrement_workspace_credits(UUID, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.decrement_workspace_credits(UUID, INTEGER) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.decrement_workspace_credits(UUID, INTEGER) TO service_role;
