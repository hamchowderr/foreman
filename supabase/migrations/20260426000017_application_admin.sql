-- Admin analytics functions (callable by service_role/postgres only)
-- Used by the internal admin dashboard to show platform-wide stats

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
  SELECT COUNT(*) INTO signin_count
  FROM auth.users
  WHERE last_sign_in_at >= CURRENT_DATE - INTERVAL '30 DAYS';
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


-- Decrement workspace credits (used by AI usage tracking)
CREATE OR REPLACE FUNCTION public.decrement_workspace_credits(ws_id UUID, amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.workspace_credits SET credits = credits - amount WHERE workspace_id = ws_id;
END;
$$;

ALTER FUNCTION public.decrement_workspace_credits(UUID, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.decrement_workspace_credits(UUID, INTEGER) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.decrement_workspace_credits(UUID, INTEGER) TO service_role;
