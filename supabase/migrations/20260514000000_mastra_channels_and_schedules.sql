-- Mastra framework tables (additive to 20260426000019_mastra.sql).
-- Owned by @mastra/pg and managed by the Mastra runtime.
-- Adds the four storage tables that ship in @mastra/pg@1.10.0 but were not
-- present when the initial mastra migration was written:
--   - mastra_channel_config, mastra_channel_installations (ChannelsPG domain)
--   - mastra_schedules, mastra_schedule_triggers (SchedulesPG domain)
-- Like the rest of the mastra_* tables, these are accessed via service_role
-- only; RLS is not enabled here. Column DDL was extracted verbatim from
-- `npx supabase db dump --local` against a DB that had Mastra runtime
-- initialize the tables.


CREATE TABLE IF NOT EXISTS public.mastra_channel_config (
    platform text NOT NULL,
    data jsonb NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_channel_config OWNER TO postgres;
ALTER TABLE public.mastra_channel_config ADD CONSTRAINT mastra_channel_config_pkey PRIMARY KEY (platform);


CREATE TABLE IF NOT EXISTS public.mastra_channel_installations (
    id text NOT NULL,
    platform text NOT NULL,
    "agentId" text NOT NULL,
    status text NOT NULL,
    "webhookId" text,
    data jsonb NOT NULL,
    "configHash" text,
    error text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_channel_installations OWNER TO postgres;
ALTER TABLE public.mastra_channel_installations ADD CONSTRAINT mastra_channel_installations_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent ON public.mastra_channel_installations USING btree (platform, "agentId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_installations_webhook ON public.mastra_channel_installations USING btree ("webhookId");


CREATE TABLE IF NOT EXISTS public.mastra_schedules (
    id text NOT NULL,
    target jsonb NOT NULL,
    cron text NOT NULL,
    timezone text,
    status text NOT NULL,
    next_fire_at bigint NOT NULL,
    last_fire_at bigint,
    last_run_id text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    metadata jsonb,
    owner_type text,
    owner_id text
);

ALTER TABLE public.mastra_schedules OWNER TO postgres;
ALTER TABLE public.mastra_schedules ADD CONSTRAINT mastra_schedules_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_schedule_triggers (
    id text NOT NULL,
    schedule_id text NOT NULL,
    run_id text,
    scheduled_fire_at bigint NOT NULL,
    actual_fire_at bigint NOT NULL,
    outcome text NOT NULL,
    error text,
    trigger_kind text NOT NULL,
    parent_trigger_id text,
    metadata jsonb
);

ALTER TABLE public.mastra_schedule_triggers OWNER TO postgres;
ALTER TABLE public.mastra_schedule_triggers ADD CONSTRAINT mastra_schedule_triggers_pkey PRIMARY KEY (id);
