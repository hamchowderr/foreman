-- Channel identities: map an external chat-platform user to a Foreman principal.
-- org_id is dropped and workspace_id added later (20260426000018). The link-code
-- table that bridges a channel account to a web account lives in
-- 20260430000000_channel_link_codes.sql.

CREATE TABLE IF NOT EXISTS public.channel_identity (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    channel text NOT NULL,
    channel_user_id text NOT NULL,
    display_name text,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.channel_identity OWNER TO postgres;
ALTER TABLE public.channel_identity ADD CONSTRAINT channel_identity_pkey PRIMARY KEY (id);
ALTER TABLE public.channel_identity
    ADD CONSTRAINT channel_identity_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
