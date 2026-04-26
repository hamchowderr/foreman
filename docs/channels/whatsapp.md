# WhatsApp

> **Coming Soon** — the adapter is wired up but WhatsApp Business API provisioning is required.

Foreman's WhatsApp integration uses `@chat-adapter/whatsapp` via the Chat SDK. It connects via the Meta WhatsApp Business API (Cloud API).

## How It Works

- **DMs** — primary mode; users message the business number directly
- **Group mentions** — @-mentions in group chats trigger a reply; the bot subscribes for follow-ups

## Prerequisites

- A Meta Business account
- A WhatsApp Business API phone number (via Meta or a BSP)
- Node.js 20+

## Setup

### 1. Create a Meta App

Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** → choose **Business**.

### 2. Add the WhatsApp Product

In your app dashboard → **Add Product** → **WhatsApp** → **Set Up**.

### 3. Configure the Webhook

**WhatsApp** → **Configuration** → **Webhook**:

- **Callback URL**: `https://your-domain.com/whatsapp/webhook`
- **Verify token**: any random string → set as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field

The webhook handler responds to `GET` requests for verification and `POST` requests for incoming messages.

### 4. Get a Phone Number & Token

- Use the test number provided in the dashboard for development
- For production: add a real business phone number
- Copy the **Temporary access token** (or generate a permanent System User token) → `WHATSAPP_ACCESS_TOKEN`
- Copy the **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`

## Environment Variables

```bash
WHATSAPP_ACCESS_TOKEN=...           # Meta system user or temporary access token
WHATSAPP_PHONE_NUMBER_ID=...        # Phone Number ID from the WhatsApp dashboard
WHATSAPP_VERIFY_TOKEN=...           # Your chosen webhook verify token
```

## Local Development

Use [ngrok](https://ngrok.com) to expose the webhook server:

```bash
ngrok http 4112
```

Set the Callback URL to your ngrok URL in the Meta app webhook configuration.

Start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Files

| File                  | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `src/whatsapp/bot.ts` | Bot singleton, event handlers, agent wiring                            |
| `src/routes/index.ts` | Mounts webhook at `POST /whatsapp/webhook` and `GET /whatsapp/webhook` |

## Troubleshooting

**Webhook verification fails:**

- `WHATSAPP_VERIFY_TOKEN` must match the verify token entered in the Meta dashboard exactly
- The `GET /whatsapp/webhook` handler must respond to the `hub.challenge` parameter

**Messages not arriving:**

- Confirm the **messages** field is subscribed in the webhook configuration
- Check that your test number has been added as a recipient in the Meta test dashboard

**Temporary access token expired:**

- Meta temporary tokens expire after 24 hours — generate a permanent System User token for production
