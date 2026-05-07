-- Granular permissions JSONB column on workspace_members
-- Admins and owners bypass the check and always have all permissions
-- Members get a default full-access set that admins can restrict

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
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
  }'::jsonb;


CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  user_id UUID,
  workspace_id UUID,
  permission TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  -- Admins and owners always have all permissions
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
