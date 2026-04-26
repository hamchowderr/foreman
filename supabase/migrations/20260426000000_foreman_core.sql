-- Foreman core application tables
-- Legacy tables carried over from Drizzle/Clerk era, migrated to Supabase
-- Note: user_id columns are TEXT (Better Auth IDs), not UUIDs
-- workspace_id columns are added later in 20260426000018_org_id_to_workspace_id.sql

CREATE SCHEMA IF NOT EXISTS public;

COMMENT ON SCHEMA public IS 'standard public schema';


-- Shared trigger function used by Mastra framework tables
CREATE FUNCTION public.trigger_set_timestamps() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW."createdAt" = NOW();
        NEW."updatedAt" = NOW();
        NEW."createdAtZ" = NOW();
        NEW."updatedAtZ" = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" = NOW();
        NEW."updatedAtZ" = NOW();
        NEW."createdAt" = OLD."createdAt";
        NEW."createdAtZ" = OLD."createdAtZ";
    END IF;
    RETURN NEW;
END;
$$;


-- Legacy user table (Better Auth schema — id is text, not UUID)
CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);

ALTER TABLE public."user" ADD CONSTRAINT user_pkey PRIMARY KEY (id);
ALTER TABLE public."user" ADD CONSTRAINT user_email_unique UNIQUE (email);


-- Action proposals: pending tool calls awaiting human approval
CREATE TABLE public.action_proposal (
    id text NOT NULL,
    conversation_id text NOT NULL,
    mastra_run_id text,
    app_key text NOT NULL,
    action_type text NOT NULL,
    action_key text NOT NULL,
    human_label text NOT NULL,
    inputs text NOT NULL,
    input_schema text NOT NULL,
    connection_id text,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.action_proposal ADD CONSTRAINT action_proposal_pkey PRIMARY KEY (id);


-- Action run results: outcome of executed proposals
CREATE TABLE public.action_run (
    id text NOT NULL,
    proposal_id text NOT NULL,
    result text NOT NULL,
    error text,
    executed_at timestamp with time zone NOT NULL
);

ALTER TABLE public.action_run ADD CONSTRAINT action_run_pkey PRIMARY KEY (id);


-- API keys for programmatic access (fmn_ prefix)
CREATE TABLE public.api_key (
    id text NOT NULL,
    user_id text NOT NULL,
    key_hash text NOT NULL,
    name text NOT NULL,
    scopes text NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.api_key ADD CONSTRAINT api_key_pkey PRIMARY KEY (id);
ALTER TABLE public.api_key ADD CONSTRAINT api_key_key_hash_unique UNIQUE (key_hash);


-- App catalog: Zapier app registry cache
CREATE TABLE public.app_catalog (
    app_key text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    categories text NOT NULL,
    auth_type text,
    action_count integer,
    embedding_text text,
    synced_at timestamp with time zone NOT NULL
);

ALTER TABLE public.app_catalog ADD CONSTRAINT app_catalog_pkey PRIMARY KEY (app_key);


-- Capability flags: per-user feature toggles
CREATE TABLE public.capability_flag (
    user_id text NOT NULL,
    capability text NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);

ALTER TABLE public.capability_flag ADD CONSTRAINT capability_flag_user_id_capability_pk PRIMARY KEY (user_id, capability);


-- Channel identities: maps external chat platform users to Foreman users
CREATE TABLE public.channel_identity (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    channel text NOT NULL,
    channel_user_id text NOT NULL,
    display_name text,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.channel_identity ADD CONSTRAINT channel_identity_pkey PRIMARY KEY (id);


-- Connection aliases: friendly names for Zapier connections
CREATE TABLE public.connection_alias (
    user_id text NOT NULL,
    alias text NOT NULL,
    app_key text NOT NULL,
    connection_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.connection_alias ADD CONSTRAINT connection_alias_user_id_alias_pk PRIMARY KEY (user_id, alias);


-- Conversations: chat sessions linking users to Mastra threads
CREATE TABLE public.conversation (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    mastra_thread_id text,
    title text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.conversation ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);


-- Workflows: saved automation sequences
CREATE TABLE public.workflow (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    source_conversation_id text,
    parameters text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_template boolean DEFAULT false NOT NULL,
    cloned_from text
);

ALTER TABLE public.workflow ADD CONSTRAINT workflow_pkey PRIMARY KEY (id);


-- Workflow runs: execution instances of a workflow
CREATE TABLE public.workflow_run (
    id text NOT NULL,
    workflow_id text NOT NULL,
    inputs text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);

ALTER TABLE public.workflow_run ADD CONSTRAINT workflow_run_pkey PRIMARY KEY (id);


-- Workflow steps: ordered action templates within a workflow
CREATE TABLE public.workflow_step (
    id text NOT NULL,
    workflow_id text NOT NULL,
    "order" integer NOT NULL,
    proposal_template text NOT NULL
);

ALTER TABLE public.workflow_step ADD CONSTRAINT workflow_step_pkey PRIMARY KEY (id);


-- Zapier identities: OAuth tokens per user
CREATE TABLE public.zapier_identity (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone,
    scopes text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.zapier_identity ADD CONSTRAINT zapier_identity_pkey PRIMARY KEY (id);
ALTER TABLE public.zapier_identity ADD CONSTRAINT zapier_identity_user_id_unique UNIQUE (user_id);


-- Foreign keys
ALTER TABLE public.action_proposal
    ADD CONSTRAINT action_proposal_conversation_id_conversation_id_fk
    FOREIGN KEY (conversation_id) REFERENCES public.conversation(id);

ALTER TABLE public.action_run
    ADD CONSTRAINT action_run_proposal_id_action_proposal_id_fk
    FOREIGN KEY (proposal_id) REFERENCES public.action_proposal(id);

ALTER TABLE public.api_key
    ADD CONSTRAINT api_key_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.capability_flag
    ADD CONSTRAINT capability_flag_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.channel_identity
    ADD CONSTRAINT channel_identity_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.connection_alias
    ADD CONSTRAINT connection_alias_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.conversation
    ADD CONSTRAINT conversation_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.workflow
    ADD CONSTRAINT workflow_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.workflow
    ADD CONSTRAINT workflow_source_conversation_id_conversation_id_fk
    FOREIGN KEY (source_conversation_id) REFERENCES public.conversation(id);

ALTER TABLE public.workflow_run
    ADD CONSTRAINT workflow_run_workflow_id_workflow_id_fk
    FOREIGN KEY (workflow_id) REFERENCES public.workflow(id);

ALTER TABLE public.workflow_step
    ADD CONSTRAINT workflow_step_workflow_id_workflow_id_fk
    FOREIGN KEY (workflow_id) REFERENCES public.workflow(id);

ALTER TABLE public.zapier_identity
    ADD CONSTRAINT zapier_identity_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
