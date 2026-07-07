-- Action proposals (pending tool calls awaiting human approval) and their run
-- results. Ownership resolves through conversation (action_proposal
-- .conversation_id -> conversation.user_id); neither table carries user_id.

CREATE TABLE IF NOT EXISTS public.action_proposal (
    id text NOT NULL,
    conversation_id text NOT NULL,
    mastra_run_id text,
    app_key text NOT NULL,
    action_type text NOT NULL,
    action_key text NOT NULL,
    human_label text NOT NULL,
    inputs text NOT NULL,
    input_schema text NOT NULL,
    connection_id text,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE public.action_proposal OWNER TO postgres;
ALTER TABLE public.action_proposal ADD CONSTRAINT action_proposal_pkey PRIMARY KEY (id);


CREATE TABLE IF NOT EXISTS public.action_run (
    id text NOT NULL,
    proposal_id text NOT NULL,
    result text NOT NULL,
    error text,
    executed_at timestamp with time zone NOT NULL
);

ALTER TABLE public.action_run OWNER TO postgres;
ALTER TABLE public.action_run ADD CONSTRAINT action_run_pkey PRIMARY KEY (id);


ALTER TABLE public.action_proposal
    ADD CONSTRAINT action_proposal_conversation_id_conversation_id_fk
    FOREIGN KEY (conversation_id) REFERENCES public.conversation(id);

ALTER TABLE public.action_run
    ADD CONSTRAINT action_run_proposal_id_action_proposal_id_fk
    FOREIGN KEY (proposal_id) REFERENCES public.action_proposal(id);
