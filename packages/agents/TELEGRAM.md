# Telegram Bot Setup

Foreman's Telegram integration uses the [Chat SDK](https://chat-sdk.dev) with `@chat-adapter/telegram`. The bot connects the Foreman Mastra agent to Telegram, handling DMs, @-mentions in groups, and follow-up messages in subscribed threads.

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Create a Bot via BotFather

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g., "Foreman")
4. Choose a username (must end in `bot`, e.g., `foreman_dev_bot`)
5. BotFather replies with your **bot token** — copy it

Optional BotFather commands:
- `/setdescription` — set the bot's description shown in the profile
- `/setabouttext` — set the "About" section
- `/setuserpic` — set the bot's avatar

## Environment Variables

Create or update `packages/agents/.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:ABCDEF...     # Required — from BotFather
TELEGRAM_BOT_USERNAME=foreman_dev_bot   # Optional — auto-detected via getMe
TELEGRAM_WEBHOOK_SECRET_TOKEN=...       # Optional — for webhook verification in production
```

## Local Development (Polling Mode)

Polling mode uses Telegram's `getUpdates` API — no public URL needed.

```bash
cd packages/agents
npm run dev:telegram
```

This starts the bot in long-polling mode. Send a message to your bot in Telegram and it will respond via the Foreman agent.

The adapter uses `mode: "auto"` by default, which detects the environment:
- **Local / long-running process**: falls back to polling
- **Serverless (Vercel, etc.)**: uses webhooks

## Production (Webhook Mode)

### 1. Deploy the agent server

The webhook endpoint is already mounted at `POST /telegram/webhook` in the Hono routes.

### 2. Register the webhook with Telegram

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/telegram/webhook",
    "secret_token": "your-webhook-secret"
  }'
```

### 3. Verify

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

You should see `"url": "https://your-domain.com/telegram/webhook"` and `"pending_update_count": 0`.

### 4. Remove webhook (to switch back to polling)

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## Architecture

```
Telegram API
    |
    v
@chat-adapter/telegram  (polling or webhook)
    |
    v
Chat SDK (event routing: DM / mention / subscribed)
    |
    v
Foreman Mastra Agent (generate reply with memory)
    |
    v
Chat SDK thread.post() -> Telegram API (send response)
```

## Files

| File | Purpose |
|------|---------|
| `src/telegram/bot.ts` | Bot singleton, event handlers, agent wiring |
| `src/telegram/webhook.ts` | Hono webhook handler |
| `src/telegram/start-polling.ts` | Entrypoint for `dev:telegram` script |
| `src/routes/index.ts` | Mounts webhook at `POST /telegram/webhook` |

## Troubleshooting

**Bot doesn't respond to messages:**
- Verify `TELEGRAM_BOT_TOKEN` is set and valid
- Check that you're messaging the correct bot username
- In groups, the bot must be added as a member and @-mentioned

**Polling mode not starting:**
- Ensure no webhook is set: run `deleteWebhook` (see above)
- Check console output for `Telegram bot started in polling mode`

**Webhook returns 401:**
- Verify `TELEGRAM_WEBHOOK_SECRET_TOKEN` matches what you passed to `setWebhook`
