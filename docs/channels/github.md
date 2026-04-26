# GitHub

Foreman's GitHub integration uses `@chat-adapter/github` via the Chat SDK. It responds to @-mentions in issues and pull request comments.

## How It Works

- **Mentions in issues/PRs** — `@your-bot-username` in a comment triggers a reply in that thread
- **Subscribed messages** — follow-up comments in threads the bot joined
- Comment-based only — no cards, modals, or UI components

The adapter is initialized with `botUserId` so it can filter out its own comments and avoid reply loops.

## Prerequisites

- A GitHub account for the bot (can be a personal account or a dedicated bot account)
- A repository or organization to install the webhook on
- Node.js 20+

## Setup

### Option A — Personal Access Token (simplest)

1. Create a GitHub account for the bot (e.g., `foreman-bot`) or use an existing account
2. Generate a **Personal Access Token (classic)** with scopes: `repo`, `write:discussion`
3. Set `GITHUB_TOKEN` and `GITHUB_BOT_USER_ID` (the numeric user ID of the bot account)

To find the numeric user ID:

```bash
curl https://api.github.com/users/your-bot-username | jq .id
```

### Option B — GitHub App (recommended for organizations)

1. Go to **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Set **Webhook URL**: `https://your-domain.com/github/webhook`
3. Set **Webhook secret** → copy it to `GITHUB_WEBHOOK_SECRET`
4. Permissions needed:
   - **Issues**: Read & Write
   - **Pull requests**: Read & Write
5. Subscribe to events: **Issue comment**, **Pull request review comment**
6. Install the app on your repo or org
7. Generate and download a **Private Key** → use `GITHUB_APP_ID` + `GITHUB_PRIVATE_KEY`

### Register the Webhook (PAT approach)

For a repo-level webhook via the GitHub API:

```bash
curl -X POST https://api.github.com/repos/OWNER/REPO/hooks \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web",
    "active": true,
    "events": ["issue_comment", "pull_request_review_comment"],
    "config": {
      "url": "https://your-domain.com/github/webhook",
      "secret": "your-webhook-secret",
      "content_type": "json"
    }
  }'
```

## Environment Variables

```bash
# PAT approach
GITHUB_TOKEN=ghp_...                # Personal access token
GITHUB_WEBHOOK_SECRET=...           # Webhook secret set when registering the webhook
GITHUB_BOT_USER_ID=123456           # Numeric user ID of the bot account

# GitHub App approach (alternative)
GITHUB_APP_ID=...
GITHUB_PRIVATE_KEY=...              # Contents of the downloaded .pem file
GITHUB_WEBHOOK_SECRET=...
GITHUB_BOT_USER_ID=123456
```

## Local Development

Use [ngrok](https://ngrok.com) to expose the webhook server:

```bash
ngrok http 4112
```

Set the webhook URL to your ngrok URL, then start the webhook server:

```bash
cd packages/agents && npm run start:webhooks
```

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `src/github/bot.ts`   | Bot singleton, event handlers, agent wiring |
| `src/routes/index.ts` | Mounts webhook at `POST /github/webhook`    |

## Troubleshooting

**Bot replies to its own comments (loop):**

- `GITHUB_BOT_USER_ID` must be set to the correct numeric ID — the adapter uses it to skip self-authored events

**Webhook not receiving events:**

- Verify the webhook is active in the repo/org settings (green checkmark on recent deliveries)
- Check `GITHUB_WEBHOOK_SECRET` matches what was set when registering

**403 on comment posting:**

- The token needs `repo` scope for private repos; `public_repo` is sufficient for public repos
