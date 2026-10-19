# Slack

Foreman's Slack integration uses `@chat-adapter/slack` on the Foreman Agent Controller (see [How Channels Work](README.md#how-channels-work)). It receives events via webhook on the main agent server and responds to DMs and @-mentions. Actions that need approval post Approve / Deny buttons in the thread.

## How It Works

The bot handles three event types:

- **DMs** — users message the bot directly in the Apps section
- **@-mentions** — `@Foreman` in any channel; the bot subscribes to the thread for follow-ups
- **Subscribed messages** — follow-up messages in threads the bot joined

## Prerequisites

- A Slack workspace where you have permission to install apps
- Node.js 20+

## Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g., "Foreman") and select your workspace

### OAuth Scopes

**OAuth & Permissions** → **Bot Token Scopes** — add:

| Scope               | Why                      |
| ------------------- | ------------------------ |
| `chat:write`        | Post messages            |
| `app_mentions:read` | Receive @-mention events |
| `im:history`        | Read DM history          |
| `im:read`           | Receive DM events        |
| `users:read`        | Resolve display names    |

### Event Subscriptions

**Event Subscriptions** → toggle **Enable Events** → set Request URL:

```
https://your-domain.com/api/agent-controllers/foreman-agent-controller/channels/slack/webhook
```

(`https://your-domain.com/slack/webhook` still works and forwards there.) Slack sends a `url_verification` challenge when you save — the webhook handler responds automatically. Subscribe to these bot events:

- `app_mention`
- `message.im`

### Interactivity

**Interactivity & Shortcuts** → toggle on → set the Request URL to the same webhook URL as above.
Without it, the Approve / Deny buttons on approval cards do nothing.

### Install & Copy Credentials

**OAuth & Permissions** → **Install to Workspace** → authorize.

Copy:

- **Bot User OAuth Token** → `SLACK_BOT_TOKEN` (starts with `xoxb-`)
- **Signing Secret** (Basic Information tab) → `SLACK_SIGNING_SECRET`

## Environment Variables

```bash
SLACK_BOT_TOKEN=xoxb-...        # Bot User OAuth Token
SLACK_SIGNING_SECRET=...        # From Basic Information tab
```

## Local Development

Run the agent server (`npm run dev` in `packages/agents`, through Infisical) and expose it with [ngrok](https://ngrok.com):

```bash
ngrok http 4111
```

Set the Event Subscriptions and Interactivity Request URLs to `https://<ngrok-subdomain>.ngrok.io/slack/webhook`.

## Files

| File                                  | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `src/channels/controller-channels.ts` | Slack/Discord/Telegram on the Agent Controller, event handlers |
| `src/channels/legacy-webhooks.ts`     | Forwards `POST /slack/webhook` to the controller channels      |
| `src/slack/oauth.ts`                  | Multi-workspace OAuth install (`GET /slack/oauth`)             |
| `src/slack/installations.ts`          | Loads stored workspace installs into the adapter               |

## Troubleshooting

**Bot doesn't respond to @-mentions:**

- Confirm `app_mention` is subscribed under Event Subscriptions
- Verify the bot is in the channel (invite with `/invite @Foreman`)
- Check `SLACK_BOT_TOKEN` starts with `xoxb-`

**Webhook verification fails (Slack shows "Your URL didn't respond with the value of the `challenge` parameter"):**

- The agent server must be running and publicly reachable before Slack will accept the URL
- Check `SLACK_SIGNING_SECRET` is correct — signature mismatch returns 401

**Bot responds to its own messages (infinite loop):**

- The adapter filters out bot messages automatically; if you see a loop, check that `SLACK_BOT_TOKEN` is a bot token, not a user token

**Missing `im:history` scope after reinstall:**

- Slack requires reinstalling the app after adding scopes — go to OAuth & Permissions → Reinstall to Workspace
