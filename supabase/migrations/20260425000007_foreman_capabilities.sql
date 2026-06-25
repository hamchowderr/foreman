-- Capability flags: per-principal feature toggles.

CREATE TABLE IF NOT EXISTS public.capability_flag (
    user_id text NOT NULL,
    capability text NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);

ALTER TABLE public.capability_flag OWNER TO postgres;
ALTER TABLE public.capability_flag ADD CONSTRAINT capability_flag_user_id_capability_pk PRIMARY KEY (user_id, capability);
ALTER TABLE public.capability_flag
    ADD CONSTRAINT capability_flag_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
