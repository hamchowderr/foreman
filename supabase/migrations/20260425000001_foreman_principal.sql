-- Foreman runtime principal table.
--
-- The unified identity every Foreman runtime table references. For web users
-- the id equals the Supabase auth.users id (identity.ensureUserExists mirrors it
-- here); channel-only users (Slack/Discord/etc.) get a standalone uuid with no
-- auth.users row, bridged to a web account via channel_link_code.
-- TEXT id (Better-Auth heritage); accessed via service_role only.

CREATE TABLE IF NOT EXISTS public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);

ALTER TABLE public."user" OWNER TO postgres;
ALTER TABLE public."user" ADD CONSTRAINT user_pkey PRIMARY KEY (id);
ALTER TABLE public."user" ADD CONSTRAINT user_email_unique UNIQUE (email);
