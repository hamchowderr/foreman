# Channel Setup Guides

Per-channel setup guides for Foreman's messaging integrations. Each file covers prerequisites, credential setup, webhook registration, local development, and troubleshooting specific to that platform.

| Channel         | Status      | File                             |
| --------------- | ----------- | -------------------------------- |
| Discord         | Ready       | [discord.md](discord.md)         |
| Slack           | Ready       | [slack.md](slack.md)             |
| Telegram        | Ready       | [telegram.md](telegram.md)       |
| Google Chat     | Ready       | [google-chat.md](google-chat.md) |
| GitHub          | Ready       | [github.md](github.md)           |
| Linear          | Ready       | [linear.md](linear.md)           |
| WhatsApp        | Coming Soon | [whatsapp.md](whatsapp.md)       |
| Microsoft Teams | Coming Soon | [teams.md](teams.md)             |
| iMessage        | Coming Soon | [imessage.md](imessage.md)       |

## How Channels Work

All channels share the same architecture:

1. The webhook server (`:4112`) receives events from the platform
2. The Chat SDK adapter normalizes the event into a standard message
3. The Foreman Mastra agent generates a reply (`agent.generate`)
4. Memory is scoped per thread but shared across channels per user — what a user said on Slack is recalled when they message from Discord

Every channel auto-registers users on first contact. No manual user provisioning is needed.

## Environment Variables Quick Reference

| Channel     | Required Vars                                                                      |
| ----------- | ---------------------------------------------------------------------------------- |
| Discord     | `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `CRON_SECRET` |
| Slack       | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`                                          |
| Telegram    | `TELEGRAM_BOT_TOKEN`                                                               |
| Google Chat | `GOOGLE_CHAT_CREDENTIALS`                                                          |
| GitHub      | `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_BOT_USER_ID`                      |
| Linear      | `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET`, `LINEAR_BOT_USERNAME`                   |
| WhatsApp    | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`       |
| Teams       | `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_APP_TENANT_ID`                        |
| iMessage    | `IMESSAGE_LOCAL`                                                                   |

Only set the vars for channels you want to enable. The webhook server skips adapters with missing credentials.
