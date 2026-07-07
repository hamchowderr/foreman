-- Chat visibility (foreman-28cz, collaboration epic foreman-wl54).
--
-- Conversations are private to their owner by default. 'workspace' makes a chat
-- READ-ONLY visible to other members of the conversation's workspace (a teammate
-- can view it but not continue it — messages are owner-keyed by Mastra resourceId,
-- so collaborative writing is a separate, future problem). 'public' is reserved
-- for a future public share link. App-layer guards enforce access; the column +
-- check keep the value sane and the partial index makes the teammate listing fast.

ALTER TABLE public.conversation
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.conversation
  DROP CONSTRAINT IF EXISTS conversation_visibility_check;
ALTER TABLE public.conversation
  ADD CONSTRAINT conversation_visibility_check
  CHECK (visibility IN ('private', 'workspace', 'public'));

-- Teammate listing reads workspace-visible chats by (workspace_id, visibility);
-- partial index since the vast majority of rows stay 'private'.
CREATE INDEX IF NOT EXISTS conversation_workspace_visibility_idx
  ON public.conversation(workspace_id, visibility)
  WHERE visibility <> 'private';
