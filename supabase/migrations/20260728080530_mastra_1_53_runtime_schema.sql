create extension if not exists "vector" with schema "public";

create sequence "public"."memory_messages_384_id_seq";


  create table "public"."mastra_favorites" (
    "userId" text not null,
    "entityType" text not null,
    "entityId" text not null,
    "createdAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_notifications" (
    "id" text not null,
    "threadId" text not null,
    "source" text not null,
    "kind" text not null,
    "priority" text not null,
    "status" text not null,
    "summary" text not null,
    "payload" jsonb,
    "resourceId" text,
    "agentId" text,
    "sourceId" text,
    "dedupeKey" text,
    "coalesceKey" text,
    "coalescedCount" integer not null,
    "attributes" jsonb,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "deliveredAt" timestamp without time zone,
    "seenAt" timestamp without time zone,
    "dismissedAt" timestamp without time zone,
    "archivedAt" timestamp without time zone,
    "discardedAt" timestamp without time zone,
    "deliverAt" timestamp without time zone,
    "summaryAt" timestamp without time zone,
    "deliveryReason" text,
    "deliveryAttempts" integer not null,
    "lastDeliveryAttemptAt" timestamp without time zone,
    "lastDeliveryError" text,
    "deliveredSignalId" text,
    "summarySignalId" text,
    "metadata" jsonb,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now(),
    "deliveredAtZ" timestamp with time zone default now(),
    "seenAtZ" timestamp with time zone default now(),
    "dismissedAtZ" timestamp with time zone default now(),
    "archivedAtZ" timestamp with time zone default now(),
    "discardedAtZ" timestamp with time zone default now(),
    "deliverAtZ" timestamp with time zone default now(),
    "summaryAtZ" timestamp with time zone default now(),
    "lastDeliveryAttemptAtZ" timestamp with time zone default now()
      );



  create table "public"."mastra_tool_provider_connections" (
    "authorId" text not null,
    "providerId" text not null,
    "connectionId" text not null,
    "toolkit" text not null,
    "label" text,
    "scope" text not null,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
      );



  create table "public"."memory_messages_384" (
    "id" integer not null default nextval('public.memory_messages_384_id_seq'::regclass),
    "vector_id" text not null,
    "embedding" public.vector(384),
    "metadata" jsonb default '{}'::jsonb
      );


alter table "public"."mastra_agent_versions" add column "browser" jsonb;

alter table "public"."mastra_agent_versions" add column "toolProviders" jsonb;

alter table "public"."mastra_agents" add column "favoriteCount" integer;

alter table "public"."mastra_agents" add column "visibility" text;

alter table "public"."mastra_background_tasks" add column "suspend_payload" jsonb;

alter table "public"."mastra_background_tasks" add column "suspendedAt" timestamp without time zone;

alter table "public"."mastra_background_tasks" add column "suspendedAtZ" timestamp with time zone default now();

alter table "public"."mastra_dataset_items" add column "externalId" text;

alter table "public"."mastra_dataset_items" add column "organizationId" text;

alter table "public"."mastra_dataset_items" add column "projectId" text;

alter table "public"."mastra_dataset_items" add column "toolMocks" jsonb;

alter table "public"."mastra_datasets" add column "candidateId" text;

alter table "public"."mastra_datasets" add column "candidateKey" text;

alter table "public"."mastra_datasets" add column "organizationId" text;

alter table "public"."mastra_datasets" add column "projectId" text;

alter table "public"."mastra_experiment_results" add column "organizationId" text;

alter table "public"."mastra_experiment_results" add column "projectId" text;

alter table "public"."mastra_experiment_results" add column "toolMockReport" jsonb;

alter table "public"."mastra_experiments" add column "organizationId" text;

alter table "public"."mastra_experiments" add column "projectId" text;

alter table "public"."mastra_scorer_definitions" add column "organizationId" text;

alter table "public"."mastra_scorer_definitions" add column "projectId" text;

alter table "public"."mastra_scorers" add column "batchId" text;

alter table "public"."mastra_scorers" add column "datasetId" text;

alter table "public"."mastra_scorers" add column "datasetItemId" text;

alter table "public"."mastra_scorers" add column "organizationId" text;

alter table "public"."mastra_scorers" add column "projectId" text;

alter table "public"."mastra_skill_versions" add column "files" jsonb;

alter table "public"."mastra_skills" add column "favoriteCount" integer;

alter table "public"."mastra_skills" add column "visibility" text;

alter sequence "public"."memory_messages_384_id_seq" owned by "public"."memory_messages_384"."id";

CREATE INDEX idx_dataset_items_external_id_history ON public.mastra_dataset_items USING btree ("datasetId", "externalId", "datasetVersion");

CREATE INDEX idx_dataset_items_org_project ON public.mastra_dataset_items USING btree ("organizationId", "projectId");

CREATE INDEX idx_datasets_candidate ON public.mastra_datasets USING btree ("candidateKey", "candidateId");

CREATE INDEX idx_datasets_org_project ON public.mastra_datasets USING btree ("organizationId", "projectId");

CREATE INDEX idx_experiment_results_org_project ON public.mastra_experiment_results USING btree ("organizationId", "projectId");

CREATE INDEX idx_experiments_org_project ON public.mastra_experiments USING btree ("organizationId", "projectId");

CREATE INDEX idx_favorites_entity ON public.mastra_favorites USING btree ("entityType", "entityId");

CREATE INDEX idx_mastra_schedule_triggers_schedule_fire ON public.mastra_schedule_triggers USING btree (schedule_id, actual_fire_at DESC);

CREATE INDEX idx_mastra_schedules_status_next_fire ON public.mastra_schedules USING btree (status, next_fire_at);

CREATE INDEX idx_notifications_coalescing ON public.mastra_notifications USING btree ("threadId", source, kind, status, "agentId", "resourceId", "dedupeKey", "coalesceKey");

CREATE INDEX idx_notifications_due ON public.mastra_notifications USING btree (status, "deliverAt", "summaryAt");

CREATE INDEX idx_notifications_thread_status_updated ON public.mastra_notifications USING btree ("threadId", status, "updatedAt");

CREATE INDEX idx_tool_provider_connections_author ON public.mastra_tool_provider_connections USING btree ("authorId", "providerId", toolkit);

CREATE UNIQUE INDEX mastra_favorites_pkey ON public.mastra_favorites USING btree ("userId", "entityType", "entityId");

CREATE UNIQUE INDEX mastra_tool_provider_connections_pkey ON public.mastra_tool_provider_connections USING btree ("authorId", "providerId", "connectionId");

CREATE INDEX memory_messages_384_md_57d95f6b_idx ON public.memory_messages_384 USING btree (((metadata ->> 'thread_id'::text)));

CREATE INDEX memory_messages_384_md_5a823b81_idx ON public.memory_messages_384 USING btree (((metadata ->> 'resource_id'::text)));

CREATE UNIQUE INDEX memory_messages_384_pkey ON public.memory_messages_384 USING btree (id);

CREATE UNIQUE INDEX memory_messages_384_vector_id_key ON public.memory_messages_384 USING btree (vector_id);

CREATE INDEX memory_messages_384_vector_idx ON public.memory_messages_384 USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');

alter table "public"."mastra_favorites" add constraint "mastra_favorites_pkey" PRIMARY KEY using index "mastra_favorites_pkey";

alter table "public"."mastra_tool_provider_connections" add constraint "mastra_tool_provider_connections_pkey" PRIMARY KEY using index "mastra_tool_provider_connections_pkey";

alter table "public"."memory_messages_384" add constraint "memory_messages_384_pkey" PRIMARY KEY using index "memory_messages_384_pkey";

alter table "public"."memory_messages_384" add constraint "memory_messages_384_vector_id_key" UNIQUE using index "memory_messages_384_vector_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

grant references on table "public"."mastra_favorites" to "anon";

grant trigger on table "public"."mastra_favorites" to "anon";

grant truncate on table "public"."mastra_favorites" to "anon";

grant references on table "public"."mastra_favorites" to "authenticated";

grant trigger on table "public"."mastra_favorites" to "authenticated";

grant truncate on table "public"."mastra_favorites" to "authenticated";

grant delete on table "public"."mastra_favorites" to "service_role";

grant insert on table "public"."mastra_favorites" to "service_role";

grant references on table "public"."mastra_favorites" to "service_role";

grant select on table "public"."mastra_favorites" to "service_role";

grant trigger on table "public"."mastra_favorites" to "service_role";

grant truncate on table "public"."mastra_favorites" to "service_role";

grant update on table "public"."mastra_favorites" to "service_role";

grant references on table "public"."mastra_notifications" to "anon";

grant trigger on table "public"."mastra_notifications" to "anon";

grant truncate on table "public"."mastra_notifications" to "anon";

grant references on table "public"."mastra_notifications" to "authenticated";

grant trigger on table "public"."mastra_notifications" to "authenticated";

grant truncate on table "public"."mastra_notifications" to "authenticated";

grant delete on table "public"."mastra_notifications" to "service_role";

grant insert on table "public"."mastra_notifications" to "service_role";

grant references on table "public"."mastra_notifications" to "service_role";

grant select on table "public"."mastra_notifications" to "service_role";

grant trigger on table "public"."mastra_notifications" to "service_role";

grant truncate on table "public"."mastra_notifications" to "service_role";

grant update on table "public"."mastra_notifications" to "service_role";

grant references on table "public"."mastra_tool_provider_connections" to "anon";

grant trigger on table "public"."mastra_tool_provider_connections" to "anon";

grant truncate on table "public"."mastra_tool_provider_connections" to "anon";

grant references on table "public"."mastra_tool_provider_connections" to "authenticated";

grant trigger on table "public"."mastra_tool_provider_connections" to "authenticated";

grant truncate on table "public"."mastra_tool_provider_connections" to "authenticated";

grant delete on table "public"."mastra_tool_provider_connections" to "service_role";

grant insert on table "public"."mastra_tool_provider_connections" to "service_role";

grant references on table "public"."mastra_tool_provider_connections" to "service_role";

grant select on table "public"."mastra_tool_provider_connections" to "service_role";

grant trigger on table "public"."mastra_tool_provider_connections" to "service_role";

grant truncate on table "public"."mastra_tool_provider_connections" to "service_role";

grant update on table "public"."mastra_tool_provider_connections" to "service_role";

grant references on table "public"."memory_messages_384" to "anon";

grant trigger on table "public"."memory_messages_384" to "anon";

grant truncate on table "public"."memory_messages_384" to "anon";

grant references on table "public"."memory_messages_384" to "authenticated";

grant trigger on table "public"."memory_messages_384" to "authenticated";

grant truncate on table "public"."memory_messages_384" to "authenticated";

grant delete on table "public"."memory_messages_384" to "service_role";

grant insert on table "public"."memory_messages_384" to "service_role";

grant references on table "public"."memory_messages_384" to "service_role";

grant select on table "public"."memory_messages_384" to "service_role";

grant trigger on table "public"."memory_messages_384" to "service_role";

grant truncate on table "public"."memory_messages_384" to "service_role";

grant update on table "public"."memory_messages_384" to "service_role";



-- ---------------------------------------------------------------------------
-- Security parity for the four tables Mastra 1.53 creates at RUNTIME.
--
-- 20260426000020_rls.sql enables RLS on the 28 mastra_* tables that existed
-- when it was written, and 20260428000000_revoke_anon_grants.sql revokes anon
-- SELECT across the schema. Neither could touch these four, because Mastra's
-- storage layer creates them on first boot — after every migration has run.
-- That left them with RLS disabled and anon grants intact.
--
-- Everything here reaches these tables through the service_role client
-- (getSupabase()), which bypasses RLS, so enabling it costs nothing and closes
-- the hole for the anon/authenticated roles.
-- ---------------------------------------------------------------------------

ALTER TABLE public.mastra_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_tool_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_messages_384 ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON TABLE public.mastra_favorites FROM anon;
REVOKE SELECT ON TABLE public.mastra_notifications FROM anon;
REVOKE SELECT ON TABLE public.mastra_tool_provider_connections FROM anon;
REVOKE SELECT ON TABLE public.memory_messages_384 FROM anon;

REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.mastra_favorites FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.mastra_notifications FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.mastra_tool_provider_connections FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.memory_messages_384 FROM anon;
