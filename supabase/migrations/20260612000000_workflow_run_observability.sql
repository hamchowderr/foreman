-- workflow_run observability (foreman-2afc)
--
-- Persist WHY a run fired and WHY it failed, so trigger-fired runs carry context
-- in run history (previously they only console.warn'd) and failures surface
-- their error instead of just flipping status to 'failed'.
--
--   error_message — the failure reason when status='failed'
--   fired_by      — how the run started: 'manual' | 'cron' | 'channel' | 'poll'
--   trigger_id    — the workflow_trigger row that fired it (null for manual runs)

ALTER TABLE public.workflow_run
    ADD COLUMN IF NOT EXISTS error_message text,
    ADD COLUMN IF NOT EXISTS fired_by text,
    ADD COLUMN IF NOT EXISTS trigger_id text;

CREATE INDEX IF NOT EXISTS workflow_run_trigger_id_idx
    ON public.workflow_run(trigger_id);
