-- stored_agent / stored_agent_version: persisted user-defined agents
-- backing the /editor UI and the /stored/agents REST routes.
--
-- Each agent has many versions; one is "current" (referenced by
-- current_version_id). Drafts that aren't current have published_at NULL.
-- Tables existed in the pre-Supabase Drizzle schema but were never ported
-- as part of the Clerk→Supabase migration. The route + UI shipped without
-- the underlying tables, which would 500 on any call.

CREATE TABLE IF NOT EXISTS public.stored_agent (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    description text,
    current_version_id text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.stored_agent OWNER TO postgres;
ALTER TABLE public.stored_agent
    ADD CONSTRAINT stored_agent_pkey PRIMARY KEY (id);
ALTER TABLE public.stored_agent
    ADD CONSTRAINT stored_agent_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS stored_agent_user_id_idx
    ON public.stored_agent(user_id);

CREATE TABLE IF NOT EXISTS public.stored_agent_version (
    id text NOT NULL,
    agent_id text NOT NULL,
    version integer NOT NULL,
    instructions text NOT NULL,
    tools text NOT NULL,           -- JSON array of tool ids
    model text NOT NULL,
    notes text,
    published_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.stored_agent_version OWNER TO postgres;
ALTER TABLE public.stored_agent_version
    ADD CONSTRAINT stored_agent_version_pkey PRIMARY KEY (id);
ALTER TABLE public.stored_agent_version
    ADD CONSTRAINT stored_agent_version_agent_id_fk
    FOREIGN KEY (agent_id) REFERENCES public.stored_agent(id) ON DELETE CASCADE;
ALTER TABLE public.stored_agent_version
    ADD CONSTRAINT stored_agent_version_unique_per_agent
    UNIQUE (agent_id, version);

CREATE INDEX IF NOT EXISTS stored_agent_version_agent_id_idx
    ON public.stored_agent_version(agent_id);

-- The current_version_id FK references stored_agent_version, but that table
-- only exists after we create it above. Add it now.
ALTER TABLE public.stored_agent
    ADD CONSTRAINT stored_agent_current_version_id_fk
    FOREIGN KEY (current_version_id) REFERENCES public.stored_agent_version(id) ON DELETE SET NULL;
