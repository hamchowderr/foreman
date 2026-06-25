-- app_data_snapshot: append-only snapshots of data pulled from a user's
-- connected apps (e.g. HubSpot contacts, Airtable records) to back dashboards.
--
-- APPEND-ONLY: one row per refresh (NOT an upsert) so we keep version history
-- and can render time-series/trend charts. The latest snapshot for a source is
-- `ORDER BY refreshed_at DESC LIMIT 1`. A retention/prune policy is a follow-up.
--
-- Populated via saveSnapshot (lib/dashboards/snapshot.ts) and read by the
-- /dashboards data endpoints. Service_role access only, like the
-- other Foreman core tables. user_id is TEXT (Better Auth IDs), matching
-- conversation/workflow; JSON payloads are stored as text and parsed in app code.

CREATE TABLE IF NOT EXISTS public.app_data_snapshot (
    id text NOT NULL,
    user_id text NOT NULL,
    workspace_id text,
    app_key text NOT NULL,
    source_config text NOT NULL,
    records text NOT NULL,
    row_count integer NOT NULL DEFAULT 0,
    trigger_id text,
    refreshed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.app_data_snapshot OWNER TO postgres;
ALTER TABLE public.app_data_snapshot
    ADD CONSTRAINT app_data_snapshot_pkey PRIMARY KEY (id);

-- Latest + history reads are scoped by (user_id, app_key) ordered by refreshed_at.
CREATE INDEX IF NOT EXISTS app_data_snapshot_user_app_refreshed_idx
    ON public.app_data_snapshot(user_id, app_key, refreshed_at DESC);

-- Service_role access only — match the other Foreman core tables (RLS not used here).
REVOKE SELECT ON TABLE public.app_data_snapshot FROM anon;
