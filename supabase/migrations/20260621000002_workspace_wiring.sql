-- Workspace wiring (Phase 2b, foreman-qhbp): give Foreman's runtime tables a
-- workspace tenant so the platform's multi-tenant model actually scopes data.
--
-- public.user (the principal) gains default_workspace_id — the active workspace a
-- principal operates in. Web users: initialized from their auto-provisioned
-- user_settings.default_workspace (handle_auth_user_created trigger). Channel-only
-- principals: a solo workspace created at registerChannelUser. Resolution reads
-- this single field uniformly.
--
-- The remaining runtime tables that lacked workspace_id gain it (conversation,
-- channel_identity, zapier_identity already have it via ...018; artifact and
-- app_data_snapshot already carry it). All columns nullable + indexed; the
-- resolve/thread/scope code lands in the agent server.

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS default_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_default_workspace_id_idx ON public."user"(default_workspace_id);

ALTER TABLE public.stored_agent
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stored_agent_workspace_id_idx ON public.stored_agent(workspace_id);

ALTER TABLE public.api_key
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS api_key_workspace_id_idx ON public.api_key(workspace_id);

ALTER TABLE public.capability_flag
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS capability_flag_workspace_id_idx ON public.capability_flag(workspace_id);

ALTER TABLE public.channel_link_code
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS channel_link_code_workspace_id_idx ON public.channel_link_code(workspace_id);

ALTER TABLE public.connection_alias
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS connection_alias_workspace_id_idx ON public.connection_alias(workspace_id);
