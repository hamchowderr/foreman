-- document_share: a capability token that makes one knowledge document
-- viewable on a public, logged-out share page (foreman-jz14, knowledge layer
-- foreman-aqjx). Mirrors dashboard_share (20260620010000) — same capability
-- model, conventions, and grants.
--
-- The token IS the grant: possessing a valid, unexpired `share_token` lets the
-- public endpoint return that document's markdown — no auth, no account. The row
-- carries the owner's `workspace_id` so the public read can resolve the document
-- from the owner's per-tenant Workspace filesystem without the viewer being
-- authenticated. `doc_path` is the workspace-relative path (e.g.
-- documents/q3-plan.md); `title` is snapshotted for display. `expires_at` is
-- nullable (NULL = never expires). Revoking a share = delete the row; the
-- document itself is untouched, so a leaked token can be cut independently.
--
-- Conventions match the other Foreman core tables: text ids, user_id is TEXT,
-- service_role access only (no RLS; service_role grants are default-privileged by
-- 20260626000001), app-set timestamps.

CREATE TABLE IF NOT EXISTS public.document_share (
    id text NOT NULL,
    doc_path text NOT NULL,
    title text,
    workspace_id uuid,
    user_id text NOT NULL,
    share_token text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.document_share OWNER TO postgres;
ALTER TABLE public.document_share ADD CONSTRAINT document_share_pkey PRIMARY KEY (id);
-- Shares belong to a workspace document; user_id is the share creator.
-- workspace_id is what the public read uses to resolve the owner's filesystem.
ALTER TABLE public.document_share
    ADD CONSTRAINT document_share_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Public reads look up by token — must be unique and fast.
CREATE UNIQUE INDEX IF NOT EXISTS document_share_token_key
    ON public.document_share(share_token);

-- Workspace-scoped reads (list/revoke a workspace's shares) + FK covering index.
CREATE INDEX IF NOT EXISTS document_share_workspace_idx
    ON public.document_share(workspace_id, doc_path);

-- Service_role access only — match the other Foreman core tables (RLS not used).
REVOKE SELECT ON TABLE public.document_share FROM anon;
