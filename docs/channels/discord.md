# Discord

Foreman's Discord integration uses `@chat-adapter/discord` via the Chat SDK. It connects via both the Gateway WebSocket (for receiving messages) and the Interactions endpoint (for slash commands and verification).

## How It Works

The bot handles three event types:

- **DMs** — users message the bot directly
- **@-mentions** — `@Foreman` in any channel; the bot subscribes to the thread for follow-ups
- **Subscribed messages** — follow-up messages in threads the bot joined

Intermediate tool steps are streamed as they finish (`onStepFinish`) to keep long-running actions visible. The final reply deduplicates any text already posted mid-stream.

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
CRON_SECRET=...                 # Any random string — used to authenticate internal Gateway restart calls
```

## Invite the Bot to a Server

```
https://discord.com/api/oauth2/authorize?client_id=<DISCORD_APPLICATION_ID>&permissions=2048&scope=bot
```

`permissions=2048` grants Send Messages. Add `&permissions=274877908992` to also allow reading message history.

## Interactions Endpoint (Production)

In the Discord Developer Portal → **General Information** → set **Interactions Endpoint URL**:

```
https://your-domain.com/discord/webhook
```

Discord will send a verification ping when you save. The webhook handler verifies the signature using `DISCORD_PUBLIC_KEY` and responds with a `PONG` — the URL must be publicly reachable before Discord accepts it.

## Gateway WebSocket

The Gateway listener starts automatically when the webhook server boots and `DISCORD_BOT_TOKEN` is set. It connects to Discord's WebSocket and receives real-time events. No additional configuration needed.

To start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Local Development

For local testing, use [ngrok](https://ngrok.com) to expose the webhook server:

```bash
ngrok http 4112
```

Set the Interactions Endpoint URL to `https://<ngrok-subdomain>.ngrok.io/discord/webhook` in the Developer Portal.

The Gateway connection works locally without ngrok — it connects outbound to Discord.

## Files

| File                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `src/discord/bot.ts`     | Bot singleton, event handlers, agent wiring                         |
| `src/discord/webhook.ts` | Hono webhook handler (signature verification + interaction routing) |
| `src/routes/index.ts`    | Mounts webhook at `POST /discord/webhook`                           |

## Troubleshooting

**Bot doesn't respond to @-mentions:**

- Confirm Message Content Intent is enabled in the Developer Portal
- Verify `DISCORD_BOT_TOKEN` is correct
- Check that the Gateway connection started: look for `[discord] Gateway connected` in the webhook server logs

**Interactions Endpoint verification fails:**

- The URL must return a valid `PONG` response before Discord accepts it — make sure the webhook server is running and publicly reachable
- Check `DISCORD_PUBLIC_KEY` matches the value in General Information

**Duplicate replies:**

- The bot deduplicates step-streamed text from the final result — if you see duplicates, check for multiple running webhook server instances

**Gateway disconnects:**

- The adapter auto-reconnects on disconnect. If it doesn't, restart the webhook server.
