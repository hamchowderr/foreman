-- Foreman initial schema
-- Extracted from live DB 2026-04-26

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: trigger_set_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_proposal; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: action_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_run (
    id text NOT NULL,
    proposal_id text NOT NULL,
    result text NOT NULL,
    error text,
    executed_at timestamp with time zone NOT NULL
);


--
-- Name: api_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key (
    id text NOT NULL,
    user_id text NOT NULL,
    key_hash text NOT NULL,
    name text NOT NULL,
    scopes text NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: app_catalog; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: capability_flag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capability_flag (
    user_id text NOT NULL,
    capability text NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);


--
-- Name: channel_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_identity (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    channel text NOT NULL,
    channel_user_id text NOT NULL,
    display_name text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: connection_alias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_alias (
    user_id text NOT NULL,
    alias text NOT NULL,
    app_key text NOT NULL,
    connection_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    mastra_thread_id text,
    title text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: mastra_agent_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_agent_versions (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text,
    instructions text NOT NULL,
    model jsonb NOT NULL,
    tools jsonb,
    "defaultOptions" jsonb,
    workflows jsonb,
    agents jsonb,
    "integrationTools" jsonb,
    "inputProcessors" jsonb,
    "outputProcessors" jsonb,
    memory jsonb,
    scorers jsonb,
    "mcpClients" jsonb,
    "requestContextSchema" jsonb,
    workspace jsonb,
    skills jsonb,
    "skillsFormat" text,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_agents (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_ai_spans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_ai_spans (
    "traceId" text NOT NULL,
    "spanId" text NOT NULL,
    name text NOT NULL,
    "spanType" text NOT NULL,
    "isEvent" boolean NOT NULL,
    "startedAt" timestamp without time zone NOT NULL,
    "parentSpanId" text,
    "entityType" text,
    "entityId" text,
    "entityName" text,
    "parentEntityType" text,
    "parentEntityId" text,
    "parentEntityName" text,
    "rootEntityType" text,
    "rootEntityId" text,
    "rootEntityName" text,
    "userId" text,
    "organizationId" text,
    "resourceId" text,
    "runId" text,
    "sessionId" text,
    "threadId" text,
    "requestId" text,
    environment text,
    "serviceName" text,
    scope jsonb,
    "entityVersionId" text,
    "parentEntityVersionId" text,
    "rootEntityVersionId" text,
    "experimentId" text,
    source text,
    metadata jsonb,
    tags jsonb,
    attributes jsonb,
    links jsonb,
    input jsonb,
    output jsonb,
    error jsonb,
    "endedAt" timestamp without time zone,
    "requestContext" jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone,
    "startedAtZ" timestamp with time zone DEFAULT now(),
    "endedAtZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_background_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_background_tasks (
    id text NOT NULL,
    tool_call_id text NOT NULL,
    tool_name text NOT NULL,
    agent_id text NOT NULL,
    run_id text NOT NULL,
    thread_id text,
    resource_id text,
    status text NOT NULL,
    args jsonb NOT NULL,
    result jsonb,
    error jsonb,
    retry_count integer NOT NULL,
    max_retries integer NOT NULL,
    timeout_ms integer NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "startedAtZ" timestamp with time zone DEFAULT now(),
    "completedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_dataset_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_dataset_items (
    id text NOT NULL,
    "datasetId" text NOT NULL,
    "datasetVersion" integer NOT NULL,
    "validTo" integer,
    "isDeleted" boolean NOT NULL,
    input jsonb NOT NULL,
    "groundTruth" jsonb,
    "requestContext" jsonb,
    metadata jsonb,
    source jsonb,
    "expectedTrajectory" jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_dataset_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_dataset_versions (
    id text NOT NULL,
    "datasetId" text NOT NULL,
    version integer NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_datasets (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    metadata jsonb,
    "inputSchema" jsonb,
    "groundTruthSchema" jsonb,
    "requestContextSchema" jsonb,
    tags jsonb,
    "targetType" text,
    "targetIds" jsonb,
    "scorerIds" jsonb,
    version integer NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_experiment_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_experiment_results (
    id text NOT NULL,
    "experimentId" text NOT NULL,
    "itemId" text NOT NULL,
    "itemDatasetVersion" integer,
    input jsonb NOT NULL,
    output jsonb,
    "groundTruth" jsonb,
    error jsonb,
    "startedAt" timestamp without time zone NOT NULL,
    "completedAt" timestamp without time zone NOT NULL,
    "retryCount" integer NOT NULL,
    "traceId" text,
    status text,
    tags jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "startedAtZ" timestamp with time zone DEFAULT now(),
    "completedAtZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_experiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_experiments (
    id text NOT NULL,
    name text,
    description text,
    metadata jsonb,
    "datasetId" text,
    "datasetVersion" integer,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    status text NOT NULL,
    "totalItems" integer NOT NULL,
    "succeededCount" integer NOT NULL,
    "failedCount" integer NOT NULL,
    "skippedCount" integer NOT NULL,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "agentVersion" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "startedAtZ" timestamp with time zone DEFAULT now(),
    "completedAtZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_mcp_client_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_mcp_client_versions (
    id text NOT NULL,
    "mcpClientId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text,
    servers jsonb NOT NULL,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_mcp_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_mcp_clients (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_mcp_server_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_mcp_server_versions (
    id text NOT NULL,
    "mcpServerId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    version text NOT NULL,
    description text,
    instructions text,
    repository jsonb,
    "releaseDate" text,
    "isLatest" boolean,
    "packageCanonical" text,
    tools jsonb,
    agents jsonb,
    workflows jsonb,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_mcp_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_mcp_servers (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_messages (
    id text NOT NULL,
    thread_id text NOT NULL,
    content text NOT NULL,
    role text NOT NULL,
    type text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "resourceId" text,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_observational_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_observational_memory (
    id text NOT NULL,
    "lookupKey" text NOT NULL,
    scope text NOT NULL,
    "resourceId" text,
    "threadId" text,
    "activeObservations" text NOT NULL,
    "activeObservationsPendingUpdate" text,
    "originType" text NOT NULL,
    config text NOT NULL,
    "generationCount" integer NOT NULL,
    "lastObservedAt" timestamp without time zone,
    "lastReflectionAt" timestamp without time zone,
    "pendingMessageTokens" integer NOT NULL,
    "totalTokensObserved" integer NOT NULL,
    "observationTokenCount" integer NOT NULL,
    "isObserving" boolean NOT NULL,
    "isReflecting" boolean NOT NULL,
    "observedMessageIds" jsonb,
    "observedTimezone" text,
    "bufferedObservations" text,
    "bufferedObservationTokens" integer,
    "bufferedMessageIds" jsonb,
    "bufferedReflection" text,
    "bufferedReflectionTokens" integer,
    "bufferedReflectionInputTokens" integer,
    "reflectedObservationLineCount" integer,
    "bufferedObservationChunks" jsonb,
    "isBufferingObservation" boolean NOT NULL,
    "isBufferingReflection" boolean NOT NULL,
    "lastBufferedAtTokens" integer NOT NULL,
    "lastBufferedAtTime" timestamp without time zone,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "lastObservedAtZ" timestamp with time zone DEFAULT now(),
    "lastReflectionAtZ" timestamp with time zone DEFAULT now(),
    "lastBufferedAtTimeZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_prompt_block_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_prompt_block_versions (
    id text NOT NULL,
    "blockId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text,
    content text NOT NULL,
    rules jsonb,
    "requestContextSchema" jsonb,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_prompt_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_prompt_blocks (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_resources (
    id text NOT NULL,
    "workingMemory" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_scorer_definition_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_scorer_definition_versions (
    id text NOT NULL,
    "scorerDefinitionId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    model jsonb,
    instructions text,
    "scoreRange" jsonb,
    "presetConfig" jsonb,
    "defaultSampling" jsonb,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_scorer_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_scorer_definitions (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_scorers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_scorers (
    id text NOT NULL,
    "scorerId" text NOT NULL,
    "traceId" text,
    "spanId" text,
    "runId" text NOT NULL,
    scorer jsonb NOT NULL,
    "preprocessStepResult" jsonb,
    "extractStepResult" jsonb,
    "analyzeStepResult" jsonb,
    score double precision NOT NULL,
    reason text,
    metadata jsonb,
    "preprocessPrompt" text,
    "extractPrompt" text,
    "generateScorePrompt" text,
    "generateReasonPrompt" text,
    "analyzePrompt" text,
    "reasonPrompt" text,
    input jsonb NOT NULL,
    output jsonb NOT NULL,
    "additionalContext" jsonb,
    "requestContext" jsonb,
    "entityType" text,
    entity jsonb,
    "entityId" text,
    source text NOT NULL,
    "resourceId" text,
    "threadId" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_skill_blobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_skill_blobs (
    hash text NOT NULL,
    content text NOT NULL,
    size integer NOT NULL,
    "mimeType" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_skill_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_skill_versions (
    id text NOT NULL,
    "skillId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    instructions text NOT NULL,
    license text,
    compatibility jsonb,
    source jsonb,
    "references" jsonb,
    scripts jsonb,
    assets jsonb,
    metadata jsonb,
    tree jsonb,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_skills (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_threads (
    id text NOT NULL,
    "resourceId" text NOT NULL,
    title text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_workflow_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_workflow_snapshot (
    workflow_name text NOT NULL,
    run_id text NOT NULL,
    "resourceId" text,
    snapshot jsonb NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_workspace_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_workspace_versions (
    id text NOT NULL,
    "workspaceId" text NOT NULL,
    "versionNumber" integer NOT NULL,
    name text NOT NULL,
    description text,
    filesystem jsonb,
    sandbox jsonb,
    mounts jsonb,
    search jsonb,
    skills jsonb,
    tools jsonb,
    "autoSync" boolean,
    "operationTimeout" integer,
    "changedFields" jsonb,
    "changeMessage" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: mastra_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastra_workspaces (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: workflow; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: workflow_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_run (
    id text NOT NULL,
    workflow_id text NOT NULL,
    inputs text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: workflow_step; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_step (
    id text NOT NULL,
    workflow_id text NOT NULL,
    "order" integer NOT NULL,
    proposal_template text NOT NULL
);


--
-- Name: zapier_identity; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: action_proposal action_proposal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_proposal
    ADD CONSTRAINT action_proposal_pkey PRIMARY KEY (id);


--
-- Name: action_run action_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_run
    ADD CONSTRAINT action_run_pkey PRIMARY KEY (id);


--
-- Name: api_key api_key_key_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_key_hash_unique UNIQUE (key_hash);


--
-- Name: api_key api_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_pkey PRIMARY KEY (id);


--
-- Name: app_catalog app_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_catalog
    ADD CONSTRAINT app_catalog_pkey PRIMARY KEY (app_key);


--
-- Name: capability_flag capability_flag_user_id_capability_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capability_flag
    ADD CONSTRAINT capability_flag_user_id_capability_pk PRIMARY KEY (user_id, capability);


--
-- Name: channel_identity channel_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_identity
    ADD CONSTRAINT channel_identity_pkey PRIMARY KEY (id);


--
-- Name: connection_alias connection_alias_user_id_alias_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_alias
    ADD CONSTRAINT connection_alias_user_id_alias_pk PRIMARY KEY (user_id, alias);


--
-- Name: conversation conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);


--
-- Name: mastra_agent_versions mastra_agent_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_agent_versions
    ADD CONSTRAINT mastra_agent_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_agents mastra_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_agents
    ADD CONSTRAINT mastra_agents_pkey PRIMARY KEY (id);


--
-- Name: mastra_background_tasks mastra_background_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_background_tasks
    ADD CONSTRAINT mastra_background_tasks_pkey PRIMARY KEY (id);


--
-- Name: mastra_dataset_items mastra_dataset_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_dataset_items
    ADD CONSTRAINT mastra_dataset_items_pkey PRIMARY KEY (id, "datasetVersion");


--
-- Name: mastra_dataset_versions mastra_dataset_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_dataset_versions
    ADD CONSTRAINT mastra_dataset_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_datasets mastra_datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_datasets
    ADD CONSTRAINT mastra_datasets_pkey PRIMARY KEY (id);


--
-- Name: mastra_experiment_results mastra_experiment_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_experiment_results
    ADD CONSTRAINT mastra_experiment_results_pkey PRIMARY KEY (id);


--
-- Name: mastra_experiments mastra_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_experiments
    ADD CONSTRAINT mastra_experiments_pkey PRIMARY KEY (id);


--
-- Name: mastra_mcp_client_versions mastra_mcp_client_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_mcp_client_versions
    ADD CONSTRAINT mastra_mcp_client_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_mcp_clients mastra_mcp_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_mcp_clients
    ADD CONSTRAINT mastra_mcp_clients_pkey PRIMARY KEY (id);


--
-- Name: mastra_mcp_server_versions mastra_mcp_server_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_mcp_server_versions
    ADD CONSTRAINT mastra_mcp_server_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_mcp_servers mastra_mcp_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_mcp_servers
    ADD CONSTRAINT mastra_mcp_servers_pkey PRIMARY KEY (id);


--
-- Name: mastra_messages mastra_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_messages
    ADD CONSTRAINT mastra_messages_pkey PRIMARY KEY (id);


--
-- Name: mastra_observational_memory mastra_observational_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_observational_memory
    ADD CONSTRAINT mastra_observational_memory_pkey PRIMARY KEY (id);


--
-- Name: mastra_prompt_block_versions mastra_prompt_block_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_prompt_block_versions
    ADD CONSTRAINT mastra_prompt_block_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_prompt_blocks mastra_prompt_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_prompt_blocks
    ADD CONSTRAINT mastra_prompt_blocks_pkey PRIMARY KEY (id);


--
-- Name: mastra_resources mastra_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_resources
    ADD CONSTRAINT mastra_resources_pkey PRIMARY KEY (id);


--
-- Name: mastra_scorer_definition_versions mastra_scorer_definition_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_scorer_definition_versions
    ADD CONSTRAINT mastra_scorer_definition_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_scorer_definitions mastra_scorer_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_scorer_definitions
    ADD CONSTRAINT mastra_scorer_definitions_pkey PRIMARY KEY (id);


--
-- Name: mastra_scorers mastra_scorers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_scorers
    ADD CONSTRAINT mastra_scorers_pkey PRIMARY KEY (id);


--
-- Name: mastra_skill_blobs mastra_skill_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_skill_blobs
    ADD CONSTRAINT mastra_skill_blobs_pkey PRIMARY KEY (hash);


--
-- Name: mastra_skill_versions mastra_skill_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_skill_versions
    ADD CONSTRAINT mastra_skill_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_skills mastra_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_skills
    ADD CONSTRAINT mastra_skills_pkey PRIMARY KEY (id);


--
-- Name: mastra_threads mastra_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_threads
    ADD CONSTRAINT mastra_threads_pkey PRIMARY KEY (id);


--
-- Name: mastra_workspace_versions mastra_workspace_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_workspace_versions
    ADD CONSTRAINT mastra_workspace_versions_pkey PRIMARY KEY (id);


--
-- Name: mastra_workspaces mastra_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_workspaces
    ADD CONSTRAINT mastra_workspaces_pkey PRIMARY KEY (id);


--
-- Name: mastra_ai_spans public_mastra_ai_spans_traceid_spanid_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_ai_spans
    ADD CONSTRAINT public_mastra_ai_spans_traceid_spanid_pk PRIMARY KEY ("traceId", "spanId");


--
-- Name: mastra_workflow_snapshot public_mastra_workflow_snapshot_workflow_name_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastra_workflow_snapshot
    ADD CONSTRAINT public_mastra_workflow_snapshot_workflow_name_run_id_key UNIQUE (workflow_name, run_id);

ALTER TABLE ONLY public.mastra_workflow_snapshot REPLICA IDENTITY USING INDEX public_mastra_workflow_snapshot_workflow_name_run_id_key;


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: workflow workflow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT workflow_pkey PRIMARY KEY (id);


--
-- Name: workflow_run workflow_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT workflow_run_pkey PRIMARY KEY (id);


--
-- Name: workflow_step workflow_step_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step
    ADD CONSTRAINT workflow_step_pkey PRIMARY KEY (id);


--
-- Name: zapier_identity zapier_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_identity
    ADD CONSTRAINT zapier_identity_pkey PRIMARY KEY (id);


--
-- Name: zapier_identity zapier_identity_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_identity
    ADD CONSTRAINT zapier_identity_user_id_unique UNIQUE (user_id);


--
-- Name: idx_dataset_items_dataset_validto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_items_dataset_validto ON public.mastra_dataset_items USING btree ("datasetId", "validTo");


--
-- Name: idx_dataset_items_dataset_validto_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_items_dataset_validto_deleted ON public.mastra_dataset_items USING btree ("datasetId", "validTo", "isDeleted");


--
-- Name: idx_dataset_items_dataset_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_items_dataset_version ON public.mastra_dataset_items USING btree ("datasetId", "datasetVersion");


--
-- Name: idx_dataset_versions_dataset_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_versions_dataset_version ON public.mastra_dataset_versions USING btree ("datasetId", version);


--
-- Name: idx_dataset_versions_dataset_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_dataset_versions_dataset_version_unique ON public.mastra_dataset_versions USING btree ("datasetId", version);


--
-- Name: idx_experiment_results_exp_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_experiment_results_exp_item ON public.mastra_experiment_results USING btree ("experimentId", "itemId");


--
-- Name: idx_experiment_results_experimentid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experiment_results_experimentid ON public.mastra_experiment_results USING btree ("experimentId");


--
-- Name: idx_experiments_datasetid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experiments_datasetid ON public.mastra_experiments USING btree ("datasetId");


--
-- Name: idx_mcp_client_versions_client_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mcp_client_versions_client_version ON public.mastra_mcp_client_versions USING btree ("mcpClientId", "versionNumber");


--
-- Name: idx_mcp_server_versions_server_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mcp_server_versions_server_version ON public.mastra_mcp_server_versions USING btree ("mcpServerId", "versionNumber");


--
-- Name: idx_om_lookup_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_om_lookup_key ON public.mastra_observational_memory USING btree ("lookupKey");


--
-- Name: idx_prompt_block_versions_block_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_prompt_block_versions_block_version ON public.mastra_prompt_block_versions USING btree ("blockId", "versionNumber");


--
-- Name: idx_scorer_definition_versions_def_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_scorer_definition_versions_def_version ON public.mastra_scorer_definition_versions USING btree ("scorerDefinitionId", "versionNumber");


--
-- Name: idx_skill_versions_skill_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_skill_versions_skill_version ON public.mastra_skill_versions USING btree ("skillId", "versionNumber");


--
-- Name: idx_workspace_versions_workspace_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workspace_versions_workspace_version ON public.mastra_workspace_versions USING btree ("workspaceId", "versionNumber");


--
-- Name: mastra_ai_spans_entitytype_entityid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_entitytype_entityid_idx ON public.mastra_ai_spans USING btree ("entityType", "entityId");


--
-- Name: mastra_ai_spans_entitytype_entityname_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_entitytype_entityname_idx ON public.mastra_ai_spans USING btree ("entityType", "entityName");


--
-- Name: mastra_ai_spans_metadata_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_metadata_gin_idx ON public.mastra_ai_spans USING gin (metadata);


--
-- Name: mastra_ai_spans_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_name_idx ON public.mastra_ai_spans USING btree (name);


--
-- Name: mastra_ai_spans_orgid_userid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_orgid_userid_idx ON public.mastra_ai_spans USING btree ("organizationId", "userId");


--
-- Name: mastra_ai_spans_parentspanid_startedat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_parentspanid_startedat_idx ON public.mastra_ai_spans USING btree ("parentSpanId", "startedAt" DESC);


--
-- Name: mastra_ai_spans_root_spans_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_root_spans_idx ON public.mastra_ai_spans USING btree ("startedAt" DESC) WHERE ("parentSpanId" IS NULL);


--
-- Name: mastra_ai_spans_spantype_startedat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_spantype_startedat_idx ON public.mastra_ai_spans USING btree ("spanType", "startedAt" DESC);


--
-- Name: mastra_ai_spans_tags_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_tags_gin_idx ON public.mastra_ai_spans USING gin (tags);


--
-- Name: mastra_ai_spans_traceid_startedat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_ai_spans_traceid_startedat_idx ON public.mastra_ai_spans USING btree ("traceId", "startedAt" DESC);


--
-- Name: mastra_bg_tasks_agent_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_bg_tasks_agent_status_idx ON public.mastra_background_tasks USING btree (agent_id, status);


--
-- Name: mastra_bg_tasks_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_bg_tasks_status_created_at_idx ON public.mastra_background_tasks USING btree (status, "createdAt");


--
-- Name: mastra_bg_tasks_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_bg_tasks_thread_idx ON public.mastra_background_tasks USING btree (thread_id, "createdAt");


--
-- Name: mastra_bg_tasks_tool_call_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_bg_tasks_tool_call_idx ON public.mastra_background_tasks USING btree (tool_call_id);


--
-- Name: mastra_messages_thread_id_createdat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_messages_thread_id_createdat_idx ON public.mastra_messages USING btree (thread_id, "createdAt" DESC);


--
-- Name: mastra_scores_trace_id_span_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_scores_trace_id_span_id_created_at_idx ON public.mastra_scorers USING btree ("traceId", "spanId", "createdAt" DESC);


--
-- Name: mastra_threads_resourceid_createdat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mastra_threads_resourceid_createdat_idx ON public.mastra_threads USING btree ("resourceId", "createdAt" DESC);


--
-- Name: mastra_ai_spans mastra_ai_spans_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mastra_ai_spans_timestamps BEFORE INSERT OR UPDATE ON public.mastra_ai_spans FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();


--
-- Name: action_proposal action_proposal_conversation_id_conversation_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_proposal
    ADD CONSTRAINT action_proposal_conversation_id_conversation_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversation(id);


--
-- Name: action_run action_run_proposal_id_action_proposal_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_run
    ADD CONSTRAINT action_run_proposal_id_action_proposal_id_fk FOREIGN KEY (proposal_id) REFERENCES public.action_proposal(id);


--
-- Name: api_key api_key_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: capability_flag capability_flag_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capability_flag
    ADD CONSTRAINT capability_flag_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: channel_identity channel_identity_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_identity
    ADD CONSTRAINT channel_identity_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: connection_alias connection_alias_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_alias
    ADD CONSTRAINT connection_alias_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: conversation conversation_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: workflow_run workflow_run_workflow_id_workflow_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT workflow_run_workflow_id_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES public.workflow(id);


--
-- Name: workflow workflow_source_conversation_id_conversation_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT workflow_source_conversation_id_conversation_id_fk FOREIGN KEY (source_conversation_id) REFERENCES public.conversation(id);


--
-- Name: workflow_step workflow_step_workflow_id_workflow_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step
    ADD CONSTRAINT workflow_step_workflow_id_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES public.workflow(id);


--
-- Name: workflow workflow_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT workflow_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: zapier_identity zapier_identity_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_identity
    ADD CONSTRAINT zapier_identity_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Schema complete
--

