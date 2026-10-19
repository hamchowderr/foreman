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

**Slack, Discord and Telegram** run on the same Agent Controller as the web chat
(`src/channels/controller-channels.ts`), on the main agent server (`:4111`):

1. Mastra's controller channels receive the platform event at
   `POST /api/agent-controllers/foreman-agent-controller/channels/<platform>/webhook`
   (the older `/slack/webhook`, `/discord/webhook` and `/telegram/webhook` paths forward there)
2. The message goes to a controller Session for that chat thread, run as the sender's Foreman user
3. Replies, tool progress and **approval cards** (Approve / Deny buttons) render back in the chat.
   Zapier writes always ask, exactly as in the web chat. Schedules, subagents and plan mode work too
4. Memory belongs to the user, so it is shared with the web chat and the other channels

Only the person who started a conversation can talk to it or answer its approval cards; anyone
else in a shared thread is asked to start their own. Chat SDK state (thread subscriptions, dedupe)
is stored in Postgres, so it survives restarts. Pending approval cards do not: after a restart, ask again.

**The other channels** (Google Chat, GitHub, Linear, WhatsApp, Teams, iMessage) still run on the
webhook server (`:4112`) and call the agent directly (`agent.generate`), without approvals or schedules.

Every channel auto-registers users on first contact. To use your web account (your connected apps,
workspace and memory) from Slack, Discord or Telegram, generate a link code in **Settings → Integrations**
and DM the bot `/link CODE`. Conversations you had before linking move to your account.

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

Only set the vars for channels you want to enable. Channels with missing credentials are skipped.
