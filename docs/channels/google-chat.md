# Google Chat

Foreman's Google Chat integration uses `@chat-adapter/gchat` via the Chat SDK. It receives events via webhook using a service account for authentication.

## How It Works

- **DMs** — users message the bot directly
- **@-mentions in spaces** — `@Foreman` in a space; the bot subscribes for follow-ups
- **Subscribed messages** — follow-up messages in spaces the bot joined

## Prerequisites

- A Google Workspace account with permission to create Chat apps
- A Google Cloud project
- Node.js 20+

## Setup

### 1. Create a Google Cloud Project

Go to [console.cloud.google.com](https://console.cloud.google.com) → **New Project**.

### 2. Enable the Google Chat API

**APIs & Services** → **Enable APIs** → search for **Google Chat API** → Enable.

### 3. Create a Service Account

**IAM & Admin** → **Service Accounts** → **Create Service Account**:

- Name: `foreman-chat-bot` (or anything)
- Role: no project-level role needed
- Click **Done**

Open the service account → **Keys** tab → **Add Key** → **JSON** → download the file.

### 4. Configure the Chat App

**Google Chat API** → **Configuration** tab:

- **App name**: Foreman
- **Avatar URL**: your logo URL
- **Description**: AI assistant for Zapier automation
- **Functionality**: enable both **Receive 1:1 messages** and **Join spaces and group conversations**
- **Connection settings**: select **App URL** → set to `https://your-domain.com/gchat/webhook`
- **Visibility**: restrict to your domain or make public

Save. Google Chat will send events to the webhook URL.

## Environment Variables

```bash
GOOGLE_CHAT_CREDENTIALS={"type":"service_account","project_id":"..."}
# Paste the entire downloaded JSON key on a single line
```

To convert the JSON file to a single line:

```bash
cat service-account-key.json | tr -d '\n'
```

## Local Development

Google Chat requires a publicly reachable URL — it does not support polling. Use [ngrok](https://ngrok.com):

```bash
ngrok http 4112
```

Update the App URL in the Chat API Configuration to your ngrok URL, then start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `src/gchat/bot.ts`    | Bot singleton, event handlers, agent wiring |
| `src/routes/index.ts` | Mounts webhook at `POST /gchat/webhook`     |

## Troubleshooting

**Bot not receiving messages:**

- Verify the App URL in the Chat API Configuration matches your running webhook server
- Check `GOOGLE_CHAT_CREDENTIALS` is valid JSON on a single line — parse errors appear at startup

**401 / authentication errors:**

- The service account JSON must be complete and unmodified
- Confirm the Chat API is enabled in the Cloud project linked to the service account

**Bot not appearing in Google Chat:**

- The Chat app must be published or explicitly shared with users in your Workspace admin settings
- Users find it via **Start a chat** → search by app name
