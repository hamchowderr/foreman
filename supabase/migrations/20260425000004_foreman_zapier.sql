-- Zapier integration tables: per-principal OAuth identity, friendly connection
-- aliases, and the global Zapier app-catalog cache. zapier_identity gains a
-- workspace_id later (20260426000018) so org/team workspaces can share a
-- connection (see lib/zapier/sdk.ts, which reads workspace_id before user_id).

CREATE TABLE IF NOT EXISTS public.zapier_identity (
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

ALTER TABLE public.zapier_identity OWNER TO postgres;
ALTER TABLE public.zapier_identity ADD CONSTRAINT zapier_identity_pkey PRIMARY KEY (id);
ALTER TABLE public.zapier_identity ADD CONSTRAINT zapier_identity_user_id_unique UNIQUE (user_id);


CREATE TABLE IF NOT EXISTS public.connection_alias (
    user_id text NOT NULL,
    alias text NOT NULL,
    app_key text NOT NULL,
    connection_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.connection_alias OWNER TO postgres;
ALTER TABLE public.connection_alias ADD CONSTRAINT connection_alias_user_id_alias_pk PRIMARY KEY (user_id, alias);


CREATE TABLE IF NOT EXISTS public.app_catalog (
    app_key text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    categories text NOT NULL,
    auth_type text,
    action_count integer,
    embedding_text text,
    synced_at timestamp with time zone NOT NULL
);

ALTER TABLE public.app_catalog OWNER TO postgres;
ALTER TABLE public.app_catalog ADD CONSTRAINT app_catalog_pkey PRIMARY KEY (app_key);


ALTER TABLE public.zapier_identity
    ADD CONSTRAINT zapier_identity_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);

ALTER TABLE public.connection_alias
    ADD CONSTRAINT connection_alias_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
