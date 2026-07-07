-- artifact: agent-generated, stored, viewable outputs. Dashboards are the first
-- `kind`; reports/mini-sites can follow without new tables (artifact-shaped
-- foundation, per the 2026-06-19 design decision).
--
-- A dashboard artifact = a constrained JSON `spec` (validated by zod server-side
-- before render) + a reference to the data it was built from (snapshot_id +
-- source_config provenance). The spec is the safety boundary that makes the
-- output safe to render in-app and (later) on public share pages.
--
-- Conventions match the other Foreman core tables: text ids, user_id is TEXT
-- (Better Auth IDs), JSON payloads stored as text and parsed in app code,
-- service_role access only (no RLS), app-set timestamps.

CREATE TABLE IF NOT EXISTS public.artifact (
    id text NOT NULL,
    user_id text NOT NULL,
    workspace_id uuid,
    kind text NOT NULL DEFAULT 'dashboard',
    title text NOT NULL,
    spec text NOT NULL,
    snapshot_id text,
    source_config text,
    visibility text NOT NULL DEFAULT 'private',
    version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.artifact OWNER TO postgres;
ALTER TABLE public.artifact ADD CONSTRAINT artifact_pkey PRIMARY KEY (id);
-- Dashboards are a SHARED workspace resource (user_id is creator attribution).
ALTER TABLE public.artifact
    ADD CONSTRAINT artifact_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- List/most-recent reads are scoped by (workspace_id, kind) ordered by updated_at.
CREATE INDEX IF NOT EXISTS artifact_workspace_kind_updated_idx
    ON public.artifact(workspace_id, kind, updated_at DESC);

-- Service_role access only — match the other Foreman core tables (RLS not used).
REVOKE SELECT ON TABLE public.artifact FROM anon;
