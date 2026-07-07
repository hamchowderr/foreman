-- Conversations: chat sessions linking a principal to a Mastra thread.
-- org_id is dropped and workspace_id added later, in
-- 20260426000018_org_id_to_workspace_id.sql.

CREATE TABLE IF NOT EXISTS public.conversation (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    mastra_thread_id text,
    title text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.conversation OWNER TO postgres;
ALTER TABLE public.conversation ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation
    ADD CONSTRAINT conversation_user_id_user_id_fk
    FOREIGN KEY (user_id) REFERENCES public."user"(id);
