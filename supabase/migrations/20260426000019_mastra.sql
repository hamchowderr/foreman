-- Mastra framework tables
-- Owned by @mastra/pg and managed by the Mastra runtime.
-- Do not modify column definitions — regenerate by running `mastra build` against a fresh DB.
-- These tables are accessed via service_role only; RLS is not enabled here.

-- Timestamp management function used internally by Mastra (attached to mastra_ai_spans)
CREATE OR REPLACE FUNCTION public.trigger_set_timestamps() RETURNS trigger
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


CREATE TABLE IF NOT EXISTS public.mastra_agents (
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

ALTER TABLE public.mastra_agents OWNER TO postgres;
ALTER TABLE public.mastra_agents ADD CONSTRAINT mastra_agents_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_agent_versions (
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

ALTER TABLE public.mastra_agent_versions OWNER TO postgres;
ALTER TABLE public.mastra_agent_versions ADD CONSTRAINT mastra_agent_versions_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_ai_spans (
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

ALTER TABLE public.mastra_ai_spans OWNER TO postgres;
ALTER TABLE public.mastra_ai_spans
    ADD CONSTRAINT public_mastra_ai_spans_traceid_spanid_pk PRIMARY KEY ("traceId", "spanId");

CREATE INDEX mastra_ai_spans_entitytype_entityid_idx ON public.mastra_ai_spans USING btree ("entityType", "entityId");
CREATE INDEX mastra_ai_spans_entitytype_entityname_idx ON public.mastra_ai_spans USING btree ("entityType", "entityName");
CREATE INDEX mastra_ai_spans_metadata_gin_idx ON public.mastra_ai_spans USING gin (metadata);
CREATE INDEX mastra_ai_spans_name_idx ON public.mastra_ai_spans USING btree (name);
CREATE INDEX mastra_ai_spans_orgid_userid_idx ON public.mastra_ai_spans USING btree ("organizationId", "userId");
CREATE INDEX mastra_ai_spans_parentspanid_startedat_idx ON public.mastra_ai_spans USING btree ("parentSpanId", "startedAt" DESC);
CREATE INDEX mastra_ai_spans_root_spans_idx ON public.mastra_ai_spans USING btree ("startedAt" DESC) WHERE ("parentSpanId" IS NULL);
CREATE INDEX mastra_ai_spans_spantype_startedat_idx ON public.mastra_ai_spans USING btree ("spanType", "startedAt" DESC);
CREATE INDEX mastra_ai_spans_tags_gin_idx ON public.mastra_ai_spans USING gin (tags);
CREATE INDEX mastra_ai_spans_traceid_startedat_idx ON public.mastra_ai_spans USING btree ("traceId", "startedAt" DESC);

CREATE TRIGGER mastra_ai_spans_timestamps
    BEFORE INSERT OR UPDATE ON public.mastra_ai_spans
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();


CREATE TABLE IF NOT EXISTS public.mastra_background_tasks (
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

ALTER TABLE public.mastra_background_tasks OWNER TO postgres;
ALTER TABLE public.mastra_background_tasks ADD CONSTRAINT mastra_background_tasks_pkey PRIMARY KEY (id);

CREATE INDEX mastra_bg_tasks_agent_status_idx ON public.mastra_background_tasks USING btree (agent_id, status);
CREATE INDEX mastra_bg_tasks_status_created_at_idx ON public.mastra_background_tasks USING btree (status, "createdAt");
CREATE INDEX mastra_bg_tasks_thread_idx ON public.mastra_background_tasks USING btree (thread_id, "createdAt");
CREATE INDEX mastra_bg_tasks_tool_call_idx ON public.mastra_background_tasks USING btree (tool_call_id);


CREATE TABLE IF NOT EXISTS public.mastra_datasets (
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

ALTER TABLE public.mastra_datasets OWNER TO postgres;
ALTER TABLE public.mastra_datasets ADD CONSTRAINT mastra_datasets_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_dataset_versions (
    id text NOT NULL,
    "datasetId" text NOT NULL,
    version integer NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_dataset_versions OWNER TO postgres;
ALTER TABLE public.mastra_dataset_versions ADD CONSTRAINT mastra_dataset_versions_pkey PRIMARY KEY (id);

CREATE INDEX idx_dataset_versions_dataset_version ON public.mastra_dataset_versions USING btree ("datasetId", version);
CREATE UNIQUE INDEX idx_dataset_versions_dataset_version_unique ON public.mastra_dataset_versions USING btree ("datasetId", version);


CREATE TABLE IF NOT EXISTS public.mastra_dataset_items (
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

ALTER TABLE public.mastra_dataset_items OWNER TO postgres;
ALTER TABLE public.mastra_dataset_items ADD CONSTRAINT mastra_dataset_items_pkey PRIMARY KEY (id, "datasetVersion");

CREATE INDEX idx_dataset_items_dataset_validto ON public.mastra_dataset_items USING btree ("datasetId", "validTo");
CREATE INDEX idx_dataset_items_dataset_validto_deleted ON public.mastra_dataset_items USING btree ("datasetId", "validTo", "isDeleted");
CREATE INDEX idx_dataset_items_dataset_version ON public.mastra_dataset_items USING btree ("datasetId", "datasetVersion");


CREATE TABLE IF NOT EXISTS public.mastra_experiments (
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

ALTER TABLE public.mastra_experiments OWNER TO postgres;
ALTER TABLE public.mastra_experiments ADD CONSTRAINT mastra_experiments_pkey PRIMARY KEY (id);

CREATE INDEX idx_experiments_datasetid ON public.mastra_experiments USING btree ("datasetId");


CREATE TABLE IF NOT EXISTS public.mastra_experiment_results (
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

ALTER TABLE public.mastra_experiment_results OWNER TO postgres;
ALTER TABLE public.mastra_experiment_results ADD CONSTRAINT mastra_experiment_results_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_experiment_results_exp_item ON public.mastra_experiment_results USING btree ("experimentId", "itemId");
CREATE INDEX idx_experiment_results_experimentid ON public.mastra_experiment_results USING btree ("experimentId");


CREATE TABLE IF NOT EXISTS public.mastra_mcp_clients (
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

ALTER TABLE public.mastra_mcp_clients OWNER TO postgres;
ALTER TABLE public.mastra_mcp_clients ADD CONSTRAINT mastra_mcp_clients_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_mcp_client_versions (
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

ALTER TABLE public.mastra_mcp_client_versions OWNER TO postgres;
ALTER TABLE public.mastra_mcp_client_versions ADD CONSTRAINT mastra_mcp_client_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_mcp_client_versions_client_version ON public.mastra_mcp_client_versions USING btree ("mcpClientId", "versionNumber");


CREATE TABLE IF NOT EXISTS public.mastra_mcp_servers (
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

ALTER TABLE public.mastra_mcp_servers OWNER TO postgres;
ALTER TABLE public.mastra_mcp_servers ADD CONSTRAINT mastra_mcp_servers_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_mcp_server_versions (
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

ALTER TABLE public.mastra_mcp_server_versions OWNER TO postgres;
ALTER TABLE public.mastra_mcp_server_versions ADD CONSTRAINT mastra_mcp_server_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_mcp_server_versions_server_version ON public.mastra_mcp_server_versions USING btree ("mcpServerId", "versionNumber");


CREATE TABLE IF NOT EXISTS public.mastra_messages (
    id text NOT NULL,
    thread_id text NOT NULL,
    content text NOT NULL,
    role text NOT NULL,
    type text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "resourceId" text,
    "createdAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_messages OWNER TO postgres;
ALTER TABLE public.mastra_messages ADD CONSTRAINT mastra_messages_pkey PRIMARY KEY (id);

CREATE INDEX mastra_messages_thread_id_createdat_idx ON public.mastra_messages USING btree (thread_id, "createdAt" DESC);


CREATE TABLE IF NOT EXISTS public.mastra_observational_memory (
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

ALTER TABLE public.mastra_observational_memory OWNER TO postgres;
ALTER TABLE public.mastra_observational_memory ADD CONSTRAINT mastra_observational_memory_pkey PRIMARY KEY (id);

CREATE INDEX idx_om_lookup_key ON public.mastra_observational_memory USING btree ("lookupKey");


CREATE TABLE IF NOT EXISTS public.mastra_prompt_blocks (
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

ALTER TABLE public.mastra_prompt_blocks OWNER TO postgres;
ALTER TABLE public.mastra_prompt_blocks ADD CONSTRAINT mastra_prompt_blocks_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_prompt_block_versions (
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

ALTER TABLE public.mastra_prompt_block_versions OWNER TO postgres;
ALTER TABLE public.mastra_prompt_block_versions ADD CONSTRAINT mastra_prompt_block_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_prompt_block_versions_block_version ON public.mastra_prompt_block_versions USING btree ("blockId", "versionNumber");


CREATE TABLE IF NOT EXISTS public.mastra_resources (
    id text NOT NULL,
    "workingMemory" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_resources OWNER TO postgres;
ALTER TABLE public.mastra_resources ADD CONSTRAINT mastra_resources_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_scorer_definitions (
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

ALTER TABLE public.mastra_scorer_definitions OWNER TO postgres;
ALTER TABLE public.mastra_scorer_definitions ADD CONSTRAINT mastra_scorer_definitions_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_scorer_definition_versions (
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

ALTER TABLE public.mastra_scorer_definition_versions OWNER TO postgres;
ALTER TABLE public.mastra_scorer_definition_versions ADD CONSTRAINT mastra_scorer_definition_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_scorer_definition_versions_def_version ON public.mastra_scorer_definition_versions USING btree ("scorerDefinitionId", "versionNumber");


CREATE TABLE IF NOT EXISTS public.mastra_scorers (
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

ALTER TABLE public.mastra_scorers OWNER TO postgres;
ALTER TABLE public.mastra_scorers ADD CONSTRAINT mastra_scorers_pkey PRIMARY KEY (id);

CREATE INDEX mastra_scores_trace_id_span_id_created_at_idx ON public.mastra_scorers USING btree ("traceId", "spanId", "createdAt" DESC);


CREATE TABLE IF NOT EXISTS public.mastra_skills (
    id text NOT NULL,
    status text NOT NULL,
    "activeVersionId" text,
    "authorId" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_skills OWNER TO postgres;
ALTER TABLE public.mastra_skills ADD CONSTRAINT mastra_skills_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_skill_blobs (
    hash text NOT NULL,
    content text NOT NULL,
    size integer NOT NULL,
    "mimeType" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_skill_blobs OWNER TO postgres;
ALTER TABLE public.mastra_skill_blobs ADD CONSTRAINT mastra_skill_blobs_pkey PRIMARY KEY (hash);


CREATE TABLE IF NOT EXISTS public.mastra_skill_versions (
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

ALTER TABLE public.mastra_skill_versions OWNER TO postgres;
ALTER TABLE public.mastra_skill_versions ADD CONSTRAINT mastra_skill_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_skill_versions_skill_version ON public.mastra_skill_versions USING btree ("skillId", "versionNumber");


CREATE TABLE IF NOT EXISTS public.mastra_threads (
    id text NOT NULL,
    "resourceId" text NOT NULL,
    title text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_threads OWNER TO postgres;
ALTER TABLE public.mastra_threads ADD CONSTRAINT mastra_threads_pkey PRIMARY KEY (id);

CREATE INDEX mastra_threads_resourceid_createdat_idx ON public.mastra_threads USING btree ("resourceId", "createdAt" DESC);


CREATE TABLE IF NOT EXISTS public.mastra_workflow_snapshot (
    workflow_name text NOT NULL,
    run_id text NOT NULL,
    "resourceId" text,
    snapshot jsonb NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mastra_workflow_snapshot OWNER TO postgres;
ALTER TABLE public.mastra_workflow_snapshot
    ADD CONSTRAINT public_mastra_workflow_snapshot_workflow_name_run_id_key UNIQUE (workflow_name, run_id);

-- Required by Mastra for real-time workflow state sync
ALTER TABLE public.mastra_workflow_snapshot
    REPLICA IDENTITY USING INDEX public_mastra_workflow_snapshot_workflow_name_run_id_key;


CREATE TABLE IF NOT EXISTS public.mastra_workspaces (
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

ALTER TABLE public.mastra_workspaces OWNER TO postgres;
ALTER TABLE public.mastra_workspaces ADD CONSTRAINT mastra_workspaces_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.mastra_workspace_versions (
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

ALTER TABLE public.mastra_workspace_versions OWNER TO postgres;
ALTER TABLE public.mastra_workspace_versions ADD CONSTRAINT mastra_workspace_versions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_workspace_versions_workspace_version ON public.mastra_workspace_versions USING btree ("workspaceId", "versionNumber");
