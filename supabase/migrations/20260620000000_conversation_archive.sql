-- Archive support for conversations.
--
-- Archiving is a non-destructive hide: the conversation row (and its Mastra
-- Memory thread) stay intact, but the sidebar history excludes it from the
-- default list. `archived_at` doubles as the flag (NULL = active) and the
-- timestamp it was archived, so an "Archived" view can sort by it.
--
-- Conventions match the other Foreman core tables: nullable app-set timestamp,
-- service_role access only (no RLS).

ALTER TABLE public.conversation
    ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- The default sidebar query is "this user's active conversations, newest first".
-- A partial index on the active rows keeps that read fast as archives accumulate.
CREATE INDEX IF NOT EXISTS conversation_user_active_idx
    ON public.conversation(user_id, updated_at DESC)
    WHERE archived_at IS NULL;
