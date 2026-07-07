-- Workspace wiring (Phase 2b, foreman-qhbp): give Foreman's workspace-scoped
-- runtime tables a workspace tenant so the platform's multi-tenant model actually
-- scopes shared data.
--
-- public.user (the principal) gains default_workspace_id — the active workspace a
-- principal operates in. Web users: initialized from their auto-provisioned
-- user_settings.default_workspace (handle_auth_user_created trigger). Channel-only
-- principals: a solo workspace created at registerChannelUser. Resolution reads
-- this single field uniformly (lib/identity.ts resolveActiveWorkspace).
--
-- Scoping model — "shared resources, private chats":
--   • SHARED (workspace-scoped): stored_agent (here) + the dashboard tables
--     (artifact, app_data_snapshot, dashboard_share — workspace_id lives in their
--     own migrations) + zapier_identity (shared connections, via ...018).
--   • PRIVATE (user-scoped, NO workspace_id): conversation, api_key,
--     capability_flag, channel_identity, channel_link_code, connection_alias.

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS default_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_default_workspace_id_idx ON public."user"(default_workspace_id);

ALTER TABLE public.stored_agent
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stored_agent_workspace_id_idx ON public.stored_agent(workspace_id);
