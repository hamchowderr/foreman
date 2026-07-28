-- Seed for the j3um /automations live verify (polling + drill-down).
-- Auth user 6637a72b-... was created via the GoTrue admin API.
-- Idempotent: safe to re-run. Remove with scripts/seed-automations-verify-down.sql.
BEGIN;

INSERT INTO workspaces (id, slug, name, membership_type, created_at)
VALUES ('11111111-2222-3333-4444-555555555555', 'verify-ws', 'Verify Workspace', 'solo', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", default_workspace_id)
VALUES (
  '6637a72b-ba57-4afb-b1fa-7e38e64430ea', 'Verify User', 'foreman-verify@local.test',
  true, now(), now(), '11111111-2222-3333-4444-555555555555'
)
ON CONFLICT (id) DO UPDATE SET default_workspace_id = EXCLUDED.default_workspace_id;

INSERT INTO automation (
  id, user_id, workspace_id, name, description, zapier_workflow_id, zapier_version_id,
  source, connections, trigger, trigger_inbox_id, enabled, status, editor_url, trigger_url,
  created_at, updated_at
) VALUES (
  'auto-verify-1', '6637a72b-ba57-4afb-b1fa-7e38e64430ea', '11111111-2222-3333-4444-555555555555',
  'Verify: GitHub issue → Slack', 'Posts new GitHub issues to Slack (seeded for UI verify).',
  'wf_verify_123', 'ver_1', '// durable source (seed)', '{}'::jsonb,
  '{"app":"github","action":"new_issue"}'::jsonb, null, true, 'active',
  'https://zapier.com/editor/wf_verify_123', null,
  now() - interval '10 minutes', now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_run (
  id, automation_id, workspace_id, inbox_message_id, trigger_id, durable_run_id,
  workflow_version_id, status, input, output, error, created_at, updated_at
) VALUES
 ('run-finished-1', 'auto-verify-1', '11111111-2222-3333-4444-555555555555', 'msg-1', 'trig-f1', 'dr-f1', null,
  'finished', '{"id":"msg-1"}'::jsonb, '{"posted":true,"channel":"#eng","ts":"1719300000.123"}'::jsonb, null,
  now() - interval '8 minutes', now() - interval '8 minutes'),
 ('run-failed-1', 'auto-verify-1', '11111111-2222-3333-4444-555555555555', 'msg-2', 'trig-x1', 'dr-x1', null,
  'failed', '{"id":"msg-2"}'::jsonb, null,
  '{"code":"execution_failed","message":"Step \"post_slack\" exhausted all retry attempts.","details":{"name":"StepExhaustedError"}}'::jsonb,
  now() - interval '5 minutes', now() - interval '5 minutes'),
 ('run-started-1', 'auto-verify-1', '11111111-2222-3333-4444-555555555555', 'msg-3', 'trig-s1', 'dr-s1', null,
  'started', '{"id":"msg-3"}'::jsonb, null, null,
  now() - interval '20 seconds', now() - interval '20 seconds')
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT 'workspaces' t, count(*) n FROM workspaces
UNION ALL SELECT 'user', count(*) FROM "user"
UNION ALL SELECT 'automation', count(*) FROM automation
UNION ALL SELECT 'automation_run', count(*) FROM automation_run;
