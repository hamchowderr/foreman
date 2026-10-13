-- conversation_share now points at an AgentController thread (foreman-mk25, rebuilt
-- for the chat kit). The web chat moved onto Mastra's AgentController (PR #49),
-- whose threads live in Mastra storage and never get a public.conversation row, so
-- the FK to conversation can't hold. The column now stores the controller's thread
-- id; the owner check moved to the route (the thread must be in the owner's own
-- Session thread list). A row left over from the old chat names a thread no
-- Session has, so its public read simply 404s.

ALTER TABLE public.conversation_share
    DROP CONSTRAINT IF EXISTS conversation_share_conversation_id_fk;

ALTER TABLE public.conversation_share RENAME COLUMN conversation_id TO thread_id;
