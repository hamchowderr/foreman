-- conversation_share: a capability token that makes one chat viewable on a
-- public, logged-out share page (foreman-mk25, collaboration epic foreman-wl54).
-- Mirrors dashboard_share (20260620010000) and document_share (20260627000000) —
-- same capability model, conventions, and grants.
--
-- The token IS the grant: possessing a valid, unexpired `share_token` lets the
-- public endpoint return that chat's messages — no auth, no account. Unlike
-- dashboards/documents (SHARED workspace resources), a chat is OWNER-scoped: only
-- the owner mints/revokes a link for their own chat, so the lib gates create/revoke
-- on user_id (not workspace membership) — a solo user with no teammates can still
-- share their chat. `workspace_id` is carried only for reference/auditing (the
-- public read resolves messages from Mastra Memory by the conversation's
-- mastra_thread_id, not by workspace). `expires_at` is nullable (NULL = never
-- expires). Revoking a share = delete the row; the chat itself is untouched, so a
-- leaked token can be cut independently of the chat's private/workspace visibility.
--
-- Conventions match the other Foreman core tables: text ids, user_id is TEXT,
-- service_role access only (auto-granted by 20260626000001 default privileges),
-- app-set timestamps. RLS is enabled at creation (no policies → deny-all for
-- anon/authenticated; service_role bypasses) to avoid the gap that document_share
-- left until 20260627000002.

CREATE TABLE IF NOT EXISTS public.conversation_share (
    id text NOT NULL,
    conversation_id text NOT NULL,
    workspace_id uuid,
    user_id text NOT NULL,
    share_token text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.conversation_share OWNER TO postgres;
ALTER TABLE public.conversation_share ADD CONSTRAINT conversation_share_pkey PRIMARY KEY (id);
-- The chat the token shares; user_id is the owner who created the link.
ALTER TABLE public.conversation_share
    ADD CONSTRAINT conversation_share_conversation_id_fk
    FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_share
    ADD CONSTRAINT conversation_share_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Public reads look up by token — must be unique and fast.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_share_token_key
    ON public.conversation_share(share_token);

-- Owner-scoped reads (does this chat have a link? revoke it) + FK covering index.
CREATE INDEX IF NOT EXISTS conversation_share_owner_idx
    ON public.conversation_share(user_id, conversation_id);

ALTER TABLE public.conversation_share ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON TABLE public.conversation_share FROM anon;
