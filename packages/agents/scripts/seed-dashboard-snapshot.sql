-- Dev-only: seed one app_data_snapshot for the local user so /dashboards renders.
-- Run: docker exec -i supabase_db_foreman psql -U postgres -d postgres < this file
-- Safe to re-run (append-only; each run adds a fresh snapshot row).
--
-- Targets the OLDEST user row rather than a hard-coded UUID, so this works on any
-- dev machine. Seed a user first (e.g. seed-automations-verify.sql) if the table
-- is empty — the insert is a no-op when the subselect finds nothing.
INSERT INTO public.app_data_snapshot
  (id, user_id, workspace_id, app_key, source_config, records, row_count, trigger_id, refreshed_at, created_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  NULL,
  'hubspot',
  '{"app":"hubspot","action":"new_contact","inputs":{}}',
  '[
    {"company":"Acme","stage":"lead","contact":"Ada Lovelace","deal_value":1200},
    {"company":"Globex","stage":"customer","contact":"Alan Turing","deal_value":8400},
    {"company":"Initech","stage":"opportunity","contact":"Grace Hopper","deal_value":5300},
    {"company":"Acme","stage":"customer","contact":"Linus Torvalds","deal_value":9100},
    {"company":"Umbrella","stage":"lead","contact":"Margaret Hamilton","deal_value":2750},
    {"company":"Globex","stage":"opportunity","contact":"Katherine Johnson","deal_value":6200},
    {"company":"Initech","stage":"customer","contact":"Dennis Ritchie","deal_value":4400},
    {"company":"Acme","stage":"opportunity","contact":"Barbara Liskov","deal_value":3100},
    {"company":"Umbrella","stage":"customer","contact":"Donald Knuth","deal_value":7700},
    {"company":"Globex","stage":"lead","contact":"Edsger Dijkstra","deal_value":1850}
  ]',
  10,
  NULL,
  now(),
  now()
FROM "user" u
ORDER BY u."createdAt"
LIMIT 1;
