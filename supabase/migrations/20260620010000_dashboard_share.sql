-- dashboard_share: a capability token that makes one artifact (dashboard)
-- viewable on a public, logged-out share page (Phase 3 of the dashboards epic).
--
-- The token IS the grant: possessing a valid, unexpired `share_token` lets the
-- public endpoint return that artifact's spec + records — no auth, no account.
-- It carries the owner's `user_id` so the public read can resolve the records
-- (which are scoped to the owner) without the viewer being authenticated.
-- `expires_at` is nullable (NULL = never expires). Revoking a share = delete the
-- row. The artifact's own `visibility` stays the owner's setting; access here is
-- gated purely on the token, so a leaked token can be cut without touching the
-- artifact.
--
-- Conventions match the other Foreman core tables: text ids, user_id is TEXT,
-- service_role access only (no RLS), app-set timestamps.

CREATE TABLE IF NOT EXISTS public.dashboard_share (
    id text NOT NULL,
    artifact_id text NOT NULL,
    user_id text NOT NULL,
    share_token text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.dashboard_share OWNER TO postgres;
ALTER TABLE public.dashboard_share ADD CONSTRAINT dashboard_share_pkey PRIMARY KEY (id);

-- Public reads look up by token — must be unique and fast.
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_share_token_key
    ON public.dashboard_share(share_token);

-- Owner-scoped reads (list/revoke a dashboard's shares).
CREATE INDEX IF NOT EXISTS dashboard_share_artifact_idx
    ON public.dashboard_share(artifact_id, user_id);

-- Service_role access only — match the other Foreman core tables (RLS not used).
REVOKE SELECT ON TABLE public.dashboard_share FROM anon;
