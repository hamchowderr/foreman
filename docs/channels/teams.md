# Microsoft Teams

> **Coming Soon** — the adapter is wired up but Azure Bot registration is required.

Foreman's Teams integration uses `@chat-adapter/teams` via the Chat SDK. The adapter is configured for `singleTenant` deployments.

## How It Works

- **DMs** — users message the bot directly in the Apps section
- **@-mentions in channels** — `@Foreman` in a Teams channel; the bot subscribes for follow-ups
- **Subscribed messages** — follow-up messages in threads the bot joined

## Prerequisites

- A Microsoft 365 account with Teams
- An Azure subscription for Bot registration
- Node.js 20+

## Setup

### 1. Register an Azure Bot

Go to [portal.azure.com](https://portal.azure.com) → **Create a resource** → search **Azure Bot** → Create.

- **Bot handle**: choose a unique name
- **Type of App**: **Single Tenant** (matches the `appType: "singleTenant"` adapter config)
- **Creation type**: Create new Microsoft App ID

After creation, go to the bot resource → **Configuration**:

- **Messaging endpoint**: `https://your-domain.com/teams/webhook`
- Copy the **Microsoft App ID** → `TEAMS_APP_ID`

Go to **Configuration** → **Manage Password** → **New client secret** → copy it → `TEAMS_APP_PASSWORD`.

Copy the **Tenant ID** from Azure Active Directory → `TEAMS_APP_TENANT_ID`.

### 2. Enable the Teams Channel

Azure Bot resource → **Channels** → **Microsoft Teams** → Enable → Save.

### 3. Create a Teams App Manifest

Create a `manifest.json` for sideloading:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "id": "<TEAMS_APP_ID>",
  "version": "1.0.0",
  "name": { "short": "Foreman" },
  "description": { "short": "AI assistant for Zapier automation" },
  "bots": [
    {
      "botId": "<TEAMS_APP_ID>",
      "scopes": ["personal", "team", "groupchat"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ]
}
```

Zip the manifest and any icons → sideload via Teams Admin Center or the Teams app upload flow.

## Environment Variables

```bash
TEAMS_APP_ID=...                    # Microsoft App ID from Azure Bot
TEAMS_APP_PASSWORD=...              # Client secret from Azure Bot
TEAMS_APP_TENANT_ID=...             # Azure AD tenant ID
```

## Local Development

Use [ngrok](https://ngrok.com) to expose the webhook server:

```bash
ngrok http 4112
```

Update the Messaging endpoint in the Azure Bot to your ngrok URL, then start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `src/teams/bot.ts`    | Bot singleton, event handlers, agent wiring |
| `src/routes/index.ts` | Mounts webhook at `POST /teams/webhook`     |

## Troubleshooting

**Bot not receiving messages:**

- Verify the Messaging endpoint in the Azure Bot matches your running webhook server
- Confirm the Teams channel is enabled in Azure Bot → Channels

**Authentication errors (401):**

- `TEAMS_APP_PASSWORD` must be the client secret value, not the secret ID
- Single-tenant apps require `TEAMS_APP_TENANT_ID` — multi-tenant apps use `common`

**Manifest validation errors:**

- The `id` in the manifest must match `TEAMS_APP_ID` exactly
- Teams requires icons at specific sizes — include a 192×192 `color.png` and 32×32 `outline.png`
