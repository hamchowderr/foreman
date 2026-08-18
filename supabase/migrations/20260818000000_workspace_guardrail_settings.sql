-- Workspace-level guardrail settings (foreman-nz8b).
--
-- The landing page advertises "Org admins set guardrail defaults for every
-- member". Until now that was a function returning frozen constants and
-- ignoring its orgId argument — no storage, no admin surface. Foreman's tenancy
-- unit is the workspace (workspace_members / is_workspace_admin), not a
-- separate "org", so the defaults belong on workspace_settings, which already
-- exists 1:1 with a workspace and already carries one policy field
-- (zapier_connection_mode).
--
-- NULL means "inherit the built-in default" rather than "no limit", so an
-- untouched workspace behaves exactly as before this migration.

alter table public.workspace_settings
  add column if not exists rate_limit_per_minute integer,
  add column if not exists rate_limit_per_hour   integer,
  add column if not exists max_bulk_items        integer,
  -- Emails are the one PII class the redactor deliberately skips, because
  -- "I sent it to john@example.com" is a legitimate reply. Workspaces handling
  -- third-party contact data can turn it on and accept that trade.
  add column if not exists redact_emails         boolean not null default false;

comment on column public.workspace_settings.rate_limit_per_minute is
  'Per-user action rate limit per minute. NULL inherits the built-in default (30).';
comment on column public.workspace_settings.rate_limit_per_hour is
  'Per-user action rate limit per hour. NULL inherits the built-in default (200).';
comment on column public.workspace_settings.max_bulk_items is
  'Bulk operations larger than this need extra confirmation. NULL inherits the built-in default (5).';
comment on column public.workspace_settings.redact_emails is
  'Redact email addresses from agent output. Off by default — see lib/processors/output.ts.';

-- Guard the values so a bad admin write cannot silently disable the limiter.
alter table public.workspace_settings
  drop constraint if exists workspace_settings_rate_limit_per_minute_check;
alter table public.workspace_settings
  add constraint workspace_settings_rate_limit_per_minute_check
  check (rate_limit_per_minute is null or rate_limit_per_minute between 1 and 10000);

alter table public.workspace_settings
  drop constraint if exists workspace_settings_rate_limit_per_hour_check;
alter table public.workspace_settings
  add constraint workspace_settings_rate_limit_per_hour_check
  check (rate_limit_per_hour is null or rate_limit_per_hour between 1 and 100000);

alter table public.workspace_settings
  drop constraint if exists workspace_settings_max_bulk_items_check;
alter table public.workspace_settings
  add constraint workspace_settings_max_bulk_items_check
  check (max_bulk_items is null or max_bulk_items between 1 and 1000);
