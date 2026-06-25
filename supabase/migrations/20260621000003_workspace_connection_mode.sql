-- Per-workspace Zapier connection-resolution policy (foreman-qhbp, step 4).
--
-- How a workspace member's Zapier SDK resolves a connection when they act:
--   • member-first (DEFAULT) — use the member's own connection if they have one,
--     else fall back to the workspace's shared (designated) connection.
--   • shared   — always use the workspace's designated connection (a zapier_identity
--                row tagged with this workspace_id), regardless of personal links.
--   • personal — use only the member's own connection; never the shared one.
--
-- Lives on workspace_settings (members view, admins set — RLS already in place).
-- An absent row ⇒ the member-first default (lib/zapier/sdk.ts
-- resolveWorkspaceConnectionMode reads this column).

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS zapier_connection_mode text NOT NULL DEFAULT 'member-first'
  CHECK (zapier_connection_mode IN ('member-first', 'shared', 'personal'));
