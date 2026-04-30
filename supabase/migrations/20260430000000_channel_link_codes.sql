-- Channel link codes: temporary codes for linking channel accounts to web accounts.
-- Users generate a code on the web, then send /link <code> in their channel bot.

CREATE TABLE IF NOT EXISTS public.channel_link_code (
    id text NOT NULL,
    user_id text NOT NULL,
    channel text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE public.channel_link_code OWNER TO postgres;
ALTER TABLE public.channel_link_code ADD CONSTRAINT channel_link_code_pkey PRIMARY KEY (id);
ALTER TABLE public.channel_link_code ADD CONSTRAINT channel_link_code_code_unique UNIQUE (code);

REVOKE SELECT ON TABLE public.channel_link_code FROM anon;
