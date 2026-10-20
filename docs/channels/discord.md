# Discord

Foreman's Discord integration uses `@chat-adapter/discord` on the Foreman Agent Controller (see [How Channels Work](README.md#how-channels-work)). It connects via both the Gateway WebSocket (for receiving messages) and the Interactions endpoint (for button clicks, slash commands and verification).

## How It Works

The bot handles three event types:

- **DMs** — users message the bot directly
- **@-mentions** — `@Foreman` in any channel; the bot subscribes to the thread for follow-ups
- **Subscribed messages** — follow-up messages in threads the bot joined

Tool steps are posted as short text updates while they run, and actions that need approval post Approve / Deny buttons.

## Prerequisites

- A Discord application with a Bot user
- **Message Content Intent** enabled (required to read message text)
- Node.js 20+

## Create the Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. **Bot** tab → **Add Bot** → copy the **Token** (`DISCORD_BOT_TOKEN`)
3. **Bot** tab → enable **Message Content Intent** under Privileged Gateway Intents
4. **General Information** tab → copy **Application ID** (`DISCORD_APPLICATION_ID`) and **Public Key** (`DISCORD_PUBLIC_KEY`)

## Environment Variables

```bash
DISCORD_BOT_TOKEN=...           # Bot token from the Bot tab
DISCORD_PUBLIC_KEY=...          # From General Information tab
DISCORD_APPLICATION_ID=...      # From General Information tab
```

## Invite the Bot to a Server

```
https://discord.com/api/oauth2/authorize?client_id=<DISCORD_APPLICATION_ID>&permissions=2048&scope=bot
```

`permissions=2048` grants Send Messages. Add `&permissions=274877908992` to also allow reading message history.

## Interactions Endpoint (Production)

In the Discord Developer Portal → **General Information** → set **Interactions Endpoint URL**:

```
https://your-domain.com/api/agent-controllers/foreman-agent-controller/channels/discord/webhook
```

(`https://your-domain.com/discord/webhook` still works and forwards there.) Discord will send a verification ping when you save. The webhook handler verifies the signature using `DISCORD_PUBLIC_KEY` and responds with a `PONG` — the URL must be publicly reachable before Discord accepts it.

## Gateway WebSocket

The Gateway listener starts with the agent server when `DISCORD_BOT_TOKEN` is set, and reconnects by itself whenever a session ends (Discord sessions are renewed every 24 hours). Run only one agent server per bot token, or every message is answered twice.

## Local Development

For local testing, use [ngrok](https://ngrok.com) to expose the agent server:

```bash
ngrok http 4111
```

Set the Interactions Endpoint URL to `https://<ngrok-subdomain>.ngrok.io/discord/webhook` in the Developer Portal.

The Gateway connection works locally without ngrok — it connects outbound to Discord.

## Files

| File                                  | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `src/channels/controller-channels.ts` | Slack/Discord/Telegram on the Agent Controller, event handlers |
| `src/channels/legacy-webhooks.ts`     | Forwards `POST /discord/webhook` to the controller channels    |

## Troubleshooting

**Bot doesn't respond to @-mentions:**

- Confirm Message Content Intent is enabled in the Developer Portal
- Verify `DISCORD_BOT_TOKEN` is correct
- Check that the Gateway connection started: look for `Discord Gateway connected` in the agent server logs

**Interactions Endpoint verification fails:**

- The URL must return a valid `PONG` response before Discord accepts it — make sure the webhook server is running and publicly reachable
- Check `DISCORD_PUBLIC_KEY` matches the value in General Information

**Duplicate replies:**

- Check for more than one agent server running with the same bot token (each opens its own Gateway connection)

**Gateway disconnects:**

- The listener reconnects on its own, retrying every 5 seconds after an error. If it doesn't, restart the agent server.
