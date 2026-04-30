-- Stores Slack workspace OAuth installations for multi-workspace bot support.
-- One row per Slack team. Bot token is AES-256-GCM encrypted at rest.
CREATE TABLE IF NOT EXISTS slack_installation (
  team_id      text PRIMARY KEY,
  team_name    text,
  bot_token    text NOT NULL,  -- encrypted via ENCRYPTION_KEY
  bot_user_id  text,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON slack_installation FROM anon, authenticated;
