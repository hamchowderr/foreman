-- Lock down EXECUTE on our public functions.
--
-- Postgres grants EXECUTE to PUBLIC by default on every new function. The
-- existing migrations revoke from `anon, authenticated` but never from PUBLIC,
-- so anon still inherited EXECUTE through it -- including on SECURITY DEFINER
-- functions reachable over PostgREST at /rest/v1/rpc/<name>.
--
-- `is_application_admin` was already correct (no PUBLIC grant, authenticated
-- retained); this brings every other function to that same shape.
--
-- Only three functions need `authenticated`: they are referenced from RLS
-- policies (is_workspace_admin x14, is_application_admin x12,
-- is_workspace_member x11) and policy evaluation runs as the querying role.
-- No application code calls any of these over RPC.

-- 1. Revoke PUBLIC/anon/authenticated everywhere.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d
      on d.objid = p.oid and d.deptype = 'e'   -- exclude extension-owned (pgvector)
    where n.nspname = 'public'
      and p.prokind = 'f'
      and d.objid is null
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- 2. Restore EXECUTE for the roles that legitimately need it.
grant execute on function public.is_workspace_admin(uuid, uuid)  to authenticated;
grant execute on function public.is_workspace_member(uuid, uuid)  to authenticated;
grant execute on function public.is_application_admin(uuid)       to authenticated;

-- custom_access_token_hook is invoked by GoTrue as supabase_auth_admin.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- 3. Pin search_path on the functions that lacked one. A mutable search_path on
--    a SECURITY DEFINER function is a privilege-escalation vector.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d
      on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proconfig is null
      and d.objid is null
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
  end loop;
end $$;
