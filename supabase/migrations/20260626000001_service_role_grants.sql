-- service_role table/sequence/function grants (foreman-usoj)
--
-- BUG: the service-role Supabase client (getSupabase(), used by every agent-server
-- read/write that is NOT a direct Mastra PostgresStore connection) talks to PostgREST,
-- which enforces table-level grants for the `service_role` Postgres role. Our migrations
-- only ever granted service_role on a handful of tables (automation, automation_run via
-- 20260626000000_automations.sql / f1cd64a; user_roles) -- never on the ~20 other tables
-- it actually reads/writes: conversation, zapier_identity, workspace_members,
-- action_proposal, action_run, api_key, artifact, capability_flag, channel_identity,
-- channel_link_code, connection_alias, app_catalog, app_data_snapshot, dashboard_share,
-- slack_installation, stored_agent, stored_agent_version, workspace_invitations,
-- workspace_settings, workspaces, user, user_settings.
--
-- A fresh `supabase db reset` can mask this via Supabase's base default privileges, but a
-- production `migration up` does not, so resolveActiveWorkspace / ensureUserExists /
-- resolveFromApiKey and many other service-role reads fail with `42501 permission denied`.
-- (Mastra's mastra_* tables were unaffected because PostgresStore connects directly as
-- `postgres`, bypassing PostgREST grants.)
--
-- FIX: restore service_role's intended Supabase semantics -- it is the trusted backend
-- role that bypasses RLS by design, so it gets full DML on every public table plus
-- default privileges for tables created by later migrations. RLS remains the security
-- boundary for anon / authenticated (untouched here); this migration is purely additive
-- for service_role and is idempotent.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
