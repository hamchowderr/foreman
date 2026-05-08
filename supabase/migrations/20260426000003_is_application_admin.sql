-- Helper function to check if the current (or given) user has application admin privileges
-- Defined early because marketing, app_settings, and other tables use it in RLS policies
-- Depends on: user_roles table (created in 00002_user.sql)

CREATE OR REPLACE FUNCTION public.is_application_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND role = 'admin'
  );
END;
$$;

ALTER FUNCTION public.is_application_admin(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_application_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_application_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_application_admin(UUID) TO service_role;
