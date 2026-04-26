# Linear

Foreman's Linear integration uses `@chat-adapter/linear` via the Chat SDK. It responds to @-mentions in issue comments.

## How It Works

- **Mentions in issues** — `@your-bot-username` in an issue comment triggers a reply
- **Subscribed messages** — follow-up comments in issues the bot joined
- Comment-based only — no cards or UI components

## Prerequisites

- A Linear workspace where you have admin access
- Node.js 20+

## Setup

### Option A — Personal API Key (simplest)

1. Go to Linear → **Settings** → **API** → **Personal API keys** → **Create key**
2. Copy the key → `LINEAR_API_KEY`
3. Set `LINEAR_BOT_USERNAME` to your Linear username (used to filter self-mentions)

### Option B — OAuth App (recommended for teams)

1. Linear → **Settings** → **API** → **OAuth applications** → **Create application**
2. Set **Redirect URI** to your domain
3. Copy `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`
4. Complete the OAuth flow to get a token

### Register the Webhook

Linear → **Settings** → **API** → **Webhooks** → **Create webhook**:

- **URL**: `https://your-domain.com/linear/webhook`
- **Secret**: generate a random string → copy to `LINEAR_WEBHOOK_SECRET`
- **Events**: enable **Comment** (created, updated)

## Environment Variables

```bash
LINEAR_API_KEY=lin_api_...          # Personal API key (Option A)
LINEAR_WEBHOOK_SECRET=...           # Webhook secret set in Linear settings
LINEAR_BOT_USERNAME=foreman-bot     # Your Linear bot's username — filters self-mentions

# OAuth (Option B — alternative to LINEAR_API_KEY)
LINEAR_CLIENT_ID=...
LINEAR_CLIENT_SECRET=...
```

## Local Development

Use [ngrok](https://ngrok.com) to expose the webhook server:

```bash
ngrok http 4112
```

Update the webhook URL in Linear settings to your ngrok URL, then start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `src/linear/bot.ts`   | Bot singleton, event handlers, agent wiring |
| `src/routes/index.ts` | Mounts webhook at `POST /linear/webhook`    |

## Troubleshooting

**Bot replies to its own comments (loop):**

- `LINEAR_BOT_USERNAME` must match the exact Linear username of the bot account

**Webhook not firing:**

- Confirm the webhook is enabled and the **Comment** event is selected in Linear settings
- Check recent webhook deliveries in Linear → Settings → API → Webhooks for error responses

**401 on comment posting:**

- Personal API keys expire — generate a new one and update `LINEAR_API_KEY`
