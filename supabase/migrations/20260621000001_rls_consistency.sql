-- RLS consistency: enable row-level security on the service-role-only tables that
-- were created after rls.sql and never had it enabled (security-rls-basics).
--
-- The app accesses these exclusively via the service_role client, which BYPASSES
-- RLS — so this is a no-op for the app. Enabling RLS with no policies denies the
-- authenticated/anon roles by default (defense-in-depth: closes the gap where an
-- authenticated JWT could otherwise read these tables directly via PostgREST) and
-- makes RLS coverage uniform across the schema. Workspace-scoped policies, if we
-- ever expose direct client reads, are added in Phase 2b.

ALTER TABLE public.app_data_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_link_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stored_agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stored_agent_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_channel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_channel_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_schedule_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_schedules ENABLE ROW LEVEL SECURITY;
