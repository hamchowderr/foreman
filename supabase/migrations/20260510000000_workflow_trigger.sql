-- workflow_trigger: binds a saved workflow to an external event source.
--
-- Three trigger types are supported by the agent / engine:
--   cron     — fires on a schedule (config: { schedule, timezone? })
--   channel  — fires when a matching message arrives on a chat channel
--              (config: { channel, match: {...} })
--   poll     — fires when a Zapier read action returns a new dedupeKey
--              (config: { app, action, connection, inputs, dedupeKey, intervalMinutes })
--
-- Cron + poll are driven by a worker process that polls this table.
-- Channel triggers are matched in-line by the channel webhook handlers.

CREATE TABLE IF NOT EXISTS public.workflow_trigger (
    id text NOT NULL,
    workflow_id text NOT NULL,
    type text NOT NULL,
    config text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    last_fired_at timestamp with time zone,
    last_dedupe_key text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.workflow_trigger OWNER TO postgres;
ALTER TABLE public.workflow_trigger
    ADD CONSTRAINT workflow_trigger_pkey PRIMARY KEY (id);
ALTER TABLE public.workflow_trigger
    ADD CONSTRAINT workflow_trigger_workflow_id_fk
    FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_trigger
    ADD CONSTRAINT workflow_trigger_type_check
    CHECK (type IN ('cron', 'channel', 'poll'));

CREATE INDEX IF NOT EXISTS workflow_trigger_workflow_id_idx
    ON public.workflow_trigger(workflow_id);
CREATE INDEX IF NOT EXISTS workflow_trigger_enabled_type_idx
    ON public.workflow_trigger(type, enabled);
