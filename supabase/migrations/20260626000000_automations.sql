-- automation: a deployed durable automation = a Zapier durable workflow (the
-- execution substrate) + an optional trigger-inbox (the trigger substrate).
-- Built on the experimental Zapier SDK (foreman-l7xq M2). A SHARED workspace
-- resource ("shared resources, private chats"): any workspace member sees and
-- manages the workspace's automations; user_id is creator attribution.
--
-- Conventions match artifact / the Foreman core tables: text ids (app-set via
-- randomUUID), user_id TEXT, workspace_id uuid FK ON DELETE SET NULL, JSON
-- payloads as jsonb, service_role access only, app-set timestamps. RLS is enabled
-- with no policies (service_role bypasses it; defense-in-depth) per the
-- rls_consistency convention.

CREATE TABLE IF NOT EXISTS public.automation (
    id text NOT NULL,
    user_id text NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    description text,
    -- The Zapier durable workflow this automation deploys to. Zapier IS the
    -- execution store; this links Foreman's record to it.
    zapier_workflow_id text NOT NULL,
    zapier_version_id text,
    -- The durable workflow.ts source, kept so the automation can be re-deployed.
    source text NOT NULL,
    -- Connection alias -> connection id map used at deploy/run.
    connections jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- The Zapier app trigger spec (selected_api/action/params); null = manual/webhook.
    trigger jsonb,
    -- The trigger-inbox backing this automation's trigger (M3), when inbox-driven.
    trigger_inbox_id text,
    enabled boolean NOT NULL DEFAULT false,
    -- active | disabled | trigger_claim_failed
    status text NOT NULL DEFAULT 'active',
    editor_url text,
    trigger_url text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.automation OWNER TO postgres;
ALTER TABLE public.automation ADD CONSTRAINT automation_pkey PRIMARY KEY (id);
ALTER TABLE public.automation
    ADD CONSTRAINT automation_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- List reads are scoped by workspace_id, newest-first.
CREATE INDEX IF NOT EXISTS automation_workspace_updated_idx
    ON public.automation(workspace_id, updated_at DESC);
-- Reverse lookup from a Zapier workflow id (e.g. the inbox worker resolving a run).
CREATE INDEX IF NOT EXISTS automation_zapier_workflow_idx
    ON public.automation(zapier_workflow_id);

ALTER TABLE public.automation ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON TABLE public.automation FROM anon;
GRANT ALL ON TABLE public.automation TO service_role;


-- automation_run: run history + the idempotency store for the trigger-inbox
-- worker (M3). Each inbox message dispatched to a durable run is recorded here;
-- UNIQUE(automation_id, inbox_message_id) makes the dedup a DB constraint so a
-- redelivery (at-least-once delivery) can't double-dispatch.

CREATE TABLE IF NOT EXISTS public.automation_run (
    id text NOT NULL,
    automation_id text NOT NULL,
    workspace_id uuid,
    -- The trigger-inbox message id (dedup key); null for manual runs.
    inbox_message_id text,
    -- Zapier ids bridging trigger -> durable run.
    trigger_id text,
    durable_run_id text,
    workflow_version_id text,
    -- initialized | running | finished | failed | skipped
    status text NOT NULL DEFAULT 'initialized',
    input jsonb,
    output jsonb,
    error jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.automation_run OWNER TO postgres;
ALTER TABLE public.automation_run ADD CONSTRAINT automation_run_pkey PRIMARY KEY (id);
ALTER TABLE public.automation_run
    ADD CONSTRAINT automation_run_automation_id_fk
    FOREIGN KEY (automation_id) REFERENCES public.automation(id) ON DELETE CASCADE;
ALTER TABLE public.automation_run
    ADD CONSTRAINT automation_run_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Idempotency: one run per (automation, inbox message). The worker inserts on
-- claim; a duplicate delivery violates this and is skipped.
CREATE UNIQUE INDEX IF NOT EXISTS automation_run_inbox_msg_uniq
    ON public.automation_run(automation_id, inbox_message_id)
    WHERE inbox_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS automation_run_automation_created_idx
    ON public.automation_run(automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_run_workspace_created_idx
    ON public.automation_run(workspace_id, created_at DESC);

ALTER TABLE public.automation_run ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON TABLE public.automation_run FROM anon;
GRANT ALL ON TABLE public.automation_run TO service_role;
