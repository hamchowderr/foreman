-- Teardown for seed-automations-verify.sql. Idempotent: safe to re-run.
-- Deletes in FK order (runs → automation → user → workspace).
--
-- Does NOT touch the auth.users row — that was created via the GoTrue admin API,
-- not by the seed, so removing it here would be deleting something we didn't make.
BEGIN;

DELETE FROM automation_run WHERE automation_id = 'auto-verify-1';
DELETE FROM automation     WHERE id = 'auto-verify-1';
DELETE FROM "user"         WHERE id = '6637a72b-ba57-4afb-b1fa-7e38e64430ea';
DELETE FROM workspaces     WHERE id = '11111111-2222-3333-4444-555555555555';

COMMIT;

SELECT 'automation_run' t, count(*) n FROM automation_run WHERE automation_id = 'auto-verify-1'
UNION ALL SELECT 'automation', count(*) FROM automation WHERE id = 'auto-verify-1'
UNION ALL SELECT 'user', count(*) FROM "user" WHERE id = '6637a72b-ba57-4afb-b1fa-7e38e64430ea'
UNION ALL SELECT 'workspaces', count(*) FROM workspaces WHERE id = '11111111-2222-3333-4444-555555555555';
