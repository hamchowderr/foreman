-- API keys for programmatic access (fmn_ prefix), per principal.

CREATE TABLE IF NOT EXISTS public.api_key (
    id text NOT NULL,
    user_id text NOT NULL,
    key_hash text NOT NULL,
    name text NOT NULL,
    scopes text NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.api_key OWNER TO postgres;
ALTER TABLE public.api_key ADD CONSTRAINT api_key_pkey PRIMARY KEY (id);
ALTER TABLE public.api_key ADD CONSTRAINT api_key_key_hash_unique UNIQUE (key_hash);
ALTER TABLE public.api_key
    ADD CONSTRAINT api_key_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
