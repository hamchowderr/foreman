# Telegram

Foreman's Telegram integration uses `@chat-adapter/telegram` via the Chat SDK. The adapter runs in `auto` mode — polling locally, webhooks in production.

## How It Works

- **DMs** — primary interaction mode; users message the bot directly
- **@-mentions in groups** — `@yourbot` in a group chat; the bot subscribes to the thread
- **Subscribed messages** — follow-up messages in threads the bot joined

## Prerequisites

- A Telegram account
- Node.js 20+

## Create a Bot via BotFather

1. Open Telegram → message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g., "Foreman")
4. Choose a username — must end in `bot` (e.g., `foreman_dev_bot`)
5. BotFather replies with your **bot token** — copy it

Optional BotFather commands:

- `/setdescription` — shown in the bot's profile
- `/setabouttext` — the "About" section
- `/setuserpic` — bot avatar

## Environment Variables

```bash
TELEGRAM_BOT_TOKEN=123456:ABCDEF...     # Required — from BotFather
TELEGRAM_BOT_USERNAME=foreman_dev_bot   # Optional — auto-detected via getMe if omitted
TELEGRAM_WEBHOOK_SECRET_TOKEN=...       # Optional — for webhook signature verification in production
```

## Local Development (Polling Mode)

The adapter detects it's running locally and falls back to long-polling automatically — no public URL needed.

```bash
cd packages/agents && npm run dev:telegram
```

This calls `bot.initialize()` which starts polling. Send a message to your bot in Telegram and it responds via the Foreman agent.

To verify the mode: look for `Telegram bot started in polling mode` in the console.

**Note:** If a webhook is registered, polling won't start. Delete the webhook first:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## Production (Webhook Mode)

### 1. Deploy the agent server

The webhook endpoint is mounted at `POST /telegram/webhook`.

### 2. Register the webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/telegram/webhook",
    "secret_token": "your-webhook-secret"
  }'
```

Set `TELEGRAM_WEBHOOK_SECRET_TOKEN` in `.env.local` to match `secret_token`.

### 3. Verify

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Expected: `"url": "https://your-domain.com/telegram/webhook"` and `"pending_update_count": 0`.

### 4. Switch back to polling

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## Files

| File                            | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `src/telegram/bot.ts`           | Bot singleton, event handlers, agent wiring |
| `src/telegram/webhook.ts`       | Hono webhook handler                        |
| `src/telegram/start-polling.ts` | Entrypoint for `npm run dev:telegram`       |
| `src/routes/index.ts`           | Mounts webhook at `POST /telegram/webhook`  |

## Troubleshooting

**Bot doesn't respond:**

- Verify `TELEGRAM_BOT_TOKEN` is set and valid
- In groups, the bot must be added as a member and @-mentioned
- Check whether polling or webhook mode is active (`getWebhookInfo`)

**Polling mode not starting:**

- Ensure no webhook is registered — run `deleteWebhook`
- Look for `Telegram bot started in polling mode` in console output

**Webhook returns 401:**

- `TELEGRAM_WEBHOOK_SECRET_TOKEN` must match the `secret_token` passed to `setWebhook`
