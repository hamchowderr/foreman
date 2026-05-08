-- Workspace triggers
-- Auto-create companion rows when a workspace is inserted
-- Auto-add member when an invitation is accepted
-- Audit log for workspace credits changes

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
