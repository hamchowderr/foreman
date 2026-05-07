-- Triggers on auth.users to auto-provision the full user stack on signup:
-- user_profiles, user_application_settings, user_roles,
-- a personal solo workspace, workspace membership, user_settings,
-- and a welcome notification

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

  -- Build a URL-safe slug from the user's display name
  workspace_slug :=
    LOWER(REGEXP_REPLACE(
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      '[^a-z0-9]', '-', 'g'
    ))
    || '-' || SUBSTRING(NEW.id::text, 1, 8);

  -- Create a personal solo workspace
  INSERT INTO public.workspaces (slug, name, membership_type)
  VALUES (
    workspace_slug,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    'solo'
  )
  RETURNING id INTO new_workspace_id;

  -- Make the user the owner of their workspace
  INSERT INTO public.workspace_members (workspace_id, workspace_member_id, workspace_member_role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Point user settings at the new default workspace
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


-- Send a welcome notification on signup
CREATE OR REPLACE FUNCTION public.handle_auth_user_created_welcome_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, payload)
  VALUES (
    NEW.id,
    '{"type": "welcome", "message": "Welcome to Foreman! Your AI automation assistant is ready."}'::jsonb
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_auth_user_created_welcome_notification() OWNER TO postgres;

CREATE OR REPLACE TRIGGER on_auth_user_created_create_welcome_notification
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created_welcome_notification();
