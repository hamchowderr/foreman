-- Migrate org_id (text) → workspace_id (UUID FK) on existing Foreman tables
-- The old org_id columns held Clerk org IDs as plain text — not used in production.
-- New workspace_id columns reference public.workspaces(id).

ALTER TABLE public.conversation
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_conversation_workspace_id ON public.conversation(workspace_id);


ALTER TABLE public.channel_identity
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_channel_identity_workspace_id ON public.channel_identity(workspace_id);


ALTER TABLE public.zapier_identity
  DROP COLUMN IF EXISTS org_id,
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_zapier_identity_workspace_id ON public.zapier_identity(workspace_id);
