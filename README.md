# Foreman

An AI assistant that helps users take actions across 9,000+ apps via Zapier. Built with [Mastra](https://mastra.ai) for agentic AI and [Vercel Chat SDK](https://chat-sdk.dev) for multi-channel delivery.

Foreman is accessible from a web UI, Slack, Telegram, Discord, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, and iMessage --- all powered by the same agent backend.

## Architecture

```
foreman/
├── packages/
│   ├── agents/          # Standalone Mastra/Hono agent server (:4111)
│   │   ├── src/
│   │   │   ├── mastra/
│   │   │   │   ├── index.ts              # Mastra instance, server config, observability
│   │   │   │   ├── agents/
│   │   │   │   │   ├── foreman.ts        # Primary agent (9 tools, memory, processors, evals)
│   │   │   │   │   ├── supervisor.ts     # Multi-agent supervisor
│   │   │   │   │   ├── discovery.ts      # App discovery subagent (Haiku)
│   │   │   │   │   ├── execution.ts      # Action execution subagent (Sonnet)
│   │   │   │   │   └── history.ts        # History search subagent (Haiku)
│   │   │   │   └── tools/                # 9 Zapier tools (discover, list, schema, execute, etc.)
│   │   │   ├── lib/
│   │   │   │   ├── zapier/               # SDK wrapper, discovery, execution, errors, connect
│   │   │   │   ├── db/                   # Drizzle ORM schema + connection (SQLite/LibSQL)
│   │   │   │   ├── stream/              # SSE encoding, transformer, types
│   │   │   │   ├── processors/          # Input (context injection) + Output (PII redaction)
│   │   │   │   ├── rag/                 # Action history indexing + semantic search
│   │   │   │   ├── identity.ts          # Channel-agnostic user resolution
│   │   │   │   ├── crypto.ts            # Token encryption (AES-256-GCM)
│   │   │   │   ├── env.ts              # Environment validation
│   │   │   │   ├── proposals.ts         # Action proposal DB access
│   │   │   │   ├── prompt-template.ts   # Dynamic system prompt builder
│   │   │   │   └── api-auth.ts          # Auth middleware
│   │   │   ├── routes/                  # Hono API routes
│   │   │   │   ├── conversations.ts     # CRUD + SSE streaming
│   │   │   │   ├── proposals.ts         # Approve/decline/field-choices
│   │   │   │   ├── middleware.ts        # Auth middleware
│   │   │   │   ├── webhooks.ts          # Channel webhook routes
│   │   │   │   └── zapier-connect.ts    # OAuth flow for non-web channels
│   │   │   ├── workflows/               # Mastra workflows
│   │   │   │   ├── daily-summary.ts     # Cron: 24h activity digest
│   │   │   │   ├── health-check.ts      # Cron: Zapier connection health
│   │   │   │   └── webhook-handler.ts   # HTTP trigger workflow
│   │   │   ├── slack/bot.ts             # Slack adapter (Chat SDK)
│   │   │   ├── telegram/bot.ts          # Telegram adapter (Chat SDK)
│   │   │   ├── discord/bot.ts           # Discord adapter (Chat SDK + Gateway)
│   │   │   ├── teams/bot.ts             # Teams adapter (Chat SDK)
│   │   │   ├── gchat/bot.ts             # Google Chat adapter (Chat SDK)
│   │   │   ├── whatsapp/bot.ts          # WhatsApp adapter (Chat SDK)
│   │   │   ├── github/bot.ts            # GitHub adapter (Chat SDK)
│   │   │   ├── linear/bot.ts            # Linear adapter (Chat SDK)
│   │   │   ├── imessage/bot.ts          # iMessage adapter (Chat SDK)
│   │   │   └── webhook-server.ts        # Standalone webhook server (:4112)
│   │   ├── drizzle/                     # SQL migrations
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                 # Next.js frontend (:3000)
│       ├── src/
│       │   ├── app/                     # Pages: chat, sign-in, sign-up
│       │   ├── components/              # Chat shell, approval cards, message components
│       │   └── lib/
│       │       └── api-client.ts        # Calls agent server via NEXT_PUBLIC_AGENT_SERVER_URL
│       ├── package.json
│       └── tsconfig.json
├── package.json             # Workspace root
├── tsconfig.json            # Base TypeScript config
├── CLAUDE.md                # AI assistant instructions
└── .beads/                  # Issue tracking (Dolt-backed)
```

## Mastra Dev Playground

When running `npm run dev` in `packages/agents`, Mastra provides a built-in dev UI at [http://localhost:4111](http://localhost:4111) where you can:

- Browse registered agents and their tools
- Test conversations interactively
- View memory, threads, and message history
- Inspect workflows and trigger runs
- See observability traces (when `OTEL_ENABLED=true`)

In production on Vercel, Mastra Studio is also available at the deployed URL when `studio: true` is set in the deployer config.

## Features

### Agent Capabilities

| Feature | Description |
|---------|-------------|
| **Zapier Integration** | Discover connections, list actions, get schemas, execute actions across 9,000+ apps |
| **Human-in-the-Loop** | Action proposals with approve/decline flow before execution |
| **Semantic Memory** | LibSQLVector-powered recall of past conversations (topK: 4) |
| **Working Memory** | Persistent user preferences and session context |
| **Observational Memory** | Learns from interaction patterns over time |
| **RAG** | Action history indexing + semantic search via `MDocument` chunking |
| **Processors** | Input: context injection (connected apps). Output: PII redaction |
| **Evals** | Answer relevancy (30%), toxicity scoring (20%) |
| **Multi-Agent** | Supervisor pattern with discovery, execution, and history subagents |
| **Workflows** | Daily summary digest, health checks, webhook handler |
| **Voice I/O** | Speech-to-text (Whisper) + text-to-speech (ElevenLabs/OpenAI), per-user toggle |
| **Dynamic Prompts** | System prompt adapts based on user's connected apps and recent actions |

### Channels

| Channel | Adapter | How It Works |
|---------|---------|-------------|
| **Web** | Next.js frontend | Clerk sessions, SSE streaming |
| **Slack** | `@chat-adapter/slack` | Webhook on `:4112/slack/webhook` |
| **Telegram** | `@chat-adapter/telegram` | Webhook or polling mode |
| **Discord** | `@chat-adapter/discord` | Gateway WebSocket + Interactions endpoint |
| **Microsoft Teams** | `@chat-adapter/teams` | Webhook on `:4112/teams/webhook` -- *Coming Soon* |
| **Google Chat** | `@chat-adapter/gchat` | Webhook on `:4112/gchat/webhook` |
| **WhatsApp** | `@chat-adapter/whatsapp` | Webhook on `:4112/whatsapp/webhook` -- *Coming Soon* |
| **GitHub** | `@chat-adapter/github` | Webhook on `:4112/github/webhook` |
| **Linear** | `@chat-adapter/linear` | Webhook on `:4112/linear/webhook` |
| **iMessage** | `chat-adapter-imessage` | Webhook on `:4112/imessage/webhook` -- *Coming Soon* |
| **MCP** | Mastra built-in | `GET /mcp/*` (Claude Code, ChatGPT, etc.) |
| **A2A** | Mastra built-in | `POST /a2a/foreman` (agent-to-agent) |

### Authentication

Foreman uses [Clerk](https://clerk.com) for user authentication and `@mastra/auth-clerk` for agent server JWT verification.

| Auth Method | Use Case |
|-------------|----------|
| Clerk (Google OAuth, email, etc.) | Web frontend sign-in/sign-up |
| `@mastra/auth-clerk` (JWKS JWT verification) | Agent server validates Clerk session tokens |
| API key (`x-api-key` header, `fmn_` prefix, SHA-256 hashed) | MCP, A2A, programmatic access |
| Channel identity | Auto-registered per platform (Slack, Discord, Telegram, etc.) |

Users from chat channels get auto-created Foreman accounts. Multiple channel identities can be linked to a single user.

### Organizations (Multi-Tenant)

Foreman supports [Clerk Organizations](https://clerk.com/docs/organizations/overview) for multi-tenant workspaces:

- `orgId` is included in the JWT and used to scope data access
- Zapier connections and conversations are scoped per organization
- The web UI includes an `OrganizationSwitcher` for switching between orgs
- Shared Zapier connections are available to all members within an org

### Capabilities

Per-user feature flags that control what actions the agent can perform. All capabilities default to **enabled**.

| Capability | Description |
|------------|-------------|
| `search` | Search/discover apps and actions |
| `read` | Read data from connected apps |
| `write` | Write/create data in connected apps |
| `execute` | Execute actions (with approval flow) |
| `raw_api` | Direct Zapier API calls |

Manage via `GET /capabilities` (list all) and `PUT /capabilities/:capability` (set `{ "enabled": true/false }`).

### Zapier Tools

| Tool | Description |
|------|-------------|
| `discover_connections` | List user's connected Zapier apps |
| `list_actions` | Get available actions for an app (search, read, write) |
| `get_action_schema` | Get input schema for a specific action |
| `get_field_choices` | Get dynamic field options (e.g., Slack channels, project lists) |
| `execute_action` | Run an action with human approval flow |
| `raw_api_call` | Direct Zapier API call for advanced use cases |
| `search_history` | Semantic search across past action results |
| `fork_conversation` | Branch a conversation for parallel exploration |
| `connect_zapier` | Generate a one-time Zapier connect URL for non-web channels |

### Workflows

Foreman can extract repeatable action sequences from conversations and save them as reusable workflows.

- **Management UI** at `/workflows` in the web frontend
- **SSE streaming** for real-time run status updates (step-by-step progress)
- **Run history** tracking with success/failure status
- Workflows are scoped per-user and linked to their source conversation

API: `GET /workflows`, `GET /workflows/:id`, `POST /workflows/:id/run` (SSE stream), `GET /workflows/:id/runs`

### Voice I/O

Foreman supports voice input and output, controllable per-user via the `voice` capability flag.

- **Speech-to-Text**: OpenAI Whisper for transcription
- **Text-to-Speech**: ElevenLabs (primary, highest quality) with OpenAI TTS fallback
- **Web UI**: Mic button next to chat input, speaker icon on agent messages
- **Channels**: Telegram voice messages, Discord voice messages, WhatsApp voice messages (*Coming Soon*)
- **Optional**: Disabled per-user via capabilities API

Env vars: `ELEVENLABS_API_KEY` (optional, falls back to OpenAI TTS), `ELEVENLABS_VOICE_ID` (optional, defaults to "Rachel"), `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini)

API: `POST /api/voice/transcribe` (multipart audio upload), `POST /api/voice/synthesize` (text → audio response)

### Guardrails

Foreman includes a multi-layer guardrail system to prevent accidental or harmful actions:

| Guardrail | Description | Default |
|-----------|-------------|---------|
| **Rate limiting** | Per-user sliding window (30/min, 200/hour) | Enabled |
| **Action risk assessment** | Classifies actions as low/medium/high/critical | Enabled |
| **Sensitive app blocking** | Banking, HR, security apps require opt-in | Blocked by default |
| **Bulk confirmation** | Requires approval for operations affecting >5 records | Enabled |
| **Org admin controls** | Org admins can override guardrail settings for all members | Configurable |
| **PII redaction** | Strips emails, API keys, phones, cards, SSNs from output | Always on |

Sensitive app categories: Banking (Stripe, PayPal, Square, Plaid, Wise), HR (BambooHR, Gusto, Rippling, Workday, ADP), Security (Okta, Auth0, 1Password)

API: `GET /api/guardrails/status`, `PUT /api/guardrails/app-access/:appKey`

## Foreman Modes

Foreman supports three operating modes, set via `FOREMAN_MODE` in `.env.local`:

| Mode | Value | Description |
|------|-------|-------------|
| **Dev** | `dev` (default) | Uses your personal Zapier CLI login. No client credentials needed. Best for local development. |
| **Production** | `production` | Multi-tenant: each user connects their own Zapier account via OAuth. Requires `ZAPIER_CLIENT_ID` and `ZAPIER_CLIENT_SECRET`. |
| **Self-Hosted** | `self_hosted` | Uses shared Zapier client credentials for all users (single account). Ideal for personal/team deployments where everyone shares one Zapier connection. |

## Zapier Configuration

Foreman uses the [Zapier SDK](https://docs.zapier.com/sdk) to execute actions across 9,000+ apps on behalf of users.

### Dev Mode (default)

Uses your personal Zapier CLI login. No client credentials needed.

```bash
npx @zapier/zapier-sdk-cli login    # One-time login
```

Set `FOREMAN_MODE=dev` in `.env.local` (or omit it --- dev is the default).

### Production Mode

For multi-tenant deployments where each user connects their own Zapier account via OAuth.

**1. Generate client credentials:**

```bash
npx zapier-sdk create-client-credentials "foreman-prod" --json
```

This returns a `client_id` and `client_secret`. Store them securely.

**2. Set environment variables:**

```bash
FOREMAN_MODE=production
ZAPIER_CLIENT_ID=<client_id from step 1>
ZAPIER_CLIENT_SECRET=<client_secret from step 1>
```

**3. User OAuth flow:**

Users connect their Zapier accounts via the web UI or by using the `connect_zapier` tool in any chat channel. The tool generates a one-time URL that initiates the OAuth flow. Tokens are encrypted at rest (AES-256-GCM) and stored per-user.

### Self-Hosted Mode

For single-account deployments where all users share one Zapier connection.

```bash
FOREMAN_MODE=self_hosted
ZAPIER_CLIENT_ID=<client_id>
ZAPIER_CLIENT_SECRET=<client_secret>
```

All users share the same Zapier credentials. No per-user OAuth flow is needed.

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- Zapier SDK CLI (`npx @zapier/zapier-sdk-cli login`)
- Platform credentials for each channel you want to enable (see [Channel Setup](#channel-setup))

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

**`packages/agents/.env.local`:**

```bash
# Required
DATABASE_URL=file:./foreman.db
ENCRYPTION_KEY=<64-char hex string>
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...        # For embeddings and voice

# Auth (Clerk)
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Zapier
FOREMAN_MODE=dev                  # "dev", "production", or "self_hosted"
ZAPIER_CLIENT_ID=...              # From: npx zapier-sdk create-client-credentials "name"
ZAPIER_CLIENT_SECRET=...

# Channels (add only what you need)
TELEGRAM_BOT_TOKEN=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
CRON_SECRET=...                   # Required for Discord Gateway
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...
TEAMS_APP_TENANT_ID=...
GOOGLE_CHAT_CREDENTIALS=...       # Service account JSON (single line)
GITHUB_TOKEN=...
GITHUB_WEBHOOK_SECRET=...

# Voice (optional — falls back to OpenAI TTS if ElevenLabs not set)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...            # Defaults to "Rachel"
GOOGLE_GENERATIVE_AI_API_KEY=...   # Gemini
```

**`packages/web/.env.local`:**

```bash
NEXT_PUBLIC_AGENT_SERVER_URL=http://localhost:4111
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### 3. Run database migrations

```bash
cd packages/agents
npx drizzle-kit migrate
```

### 4. Generate encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Start development servers

```bash
# Terminal 1: Agent server (Mastra + Hono on :4111)
cd packages/agents && npm run dev

# Terminal 2: Webhook server (Chat SDK channels on :4112)
cd packages/agents && npm run start:webhooks

# Terminal 3: Web frontend (Next.js on :3000)
cd packages/web && npm run dev
```

### 6. Test with AIMock (optional)

For deterministic testing without real API calls (LLM, voice, MCP, A2A):

```bash
cd packages/agents && npm run dev:mock
```

## Channel Setup

### Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Event Subscriptions** with URL: `https://<your-domain>/slack/webhook`
3. Subscribe to: `app_mention`, `message.im`
4. Add OAuth scopes: `chat:write`, `users:read`, `app_mentions:read`
5. Install to workspace and copy Bot Token + Signing Secret
6. Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` in `.env.local`

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Copy the bot token
3. Set `TELEGRAM_BOT_TOKEN` in `.env.local`
4. **Webhook mode:** Set webhook URL via Telegram API to `https://<your-domain>/telegram/webhook`
5. **Polling mode:** `cd packages/agents && npx tsx src/telegram/start-polling.ts`

### Discord

1. Create an app at [discord.com/developers](https://discord.com/developers/applications)
2. Create a Bot, copy token
3. Enable **Privileged Gateway Intents**: Message Content Intent
4. Set **Interactions Endpoint URL** to `https://<your-domain>/discord/webhook`
5. Invite bot to server: `https://discord.com/api/oauth2/authorize?client_id=<APP_ID>&permissions=2048&scope=bot`
6. Set `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `CRON_SECRET`

Discord uses a Gateway WebSocket connection for receiving messages. The webhook server automatically starts the Gateway listener on boot when `DISCORD_BOT_TOKEN` is set.

### Google Chat

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Chat API
3. Create a Service Account with Chat Bot scope
4. Download the JSON key and set `GOOGLE_CHAT_CREDENTIALS` (entire JSON on one line)
5. Configure the Chat app in Google Workspace with webhook URL: `https://<your-domain>/gchat/webhook`

### Microsoft Teams -- *Coming Soon*

1. Register a bot in [Azure Portal](https://portal.azure.com) (Azure Bot resource)
2. Set messaging endpoint to `https://<your-domain>/teams/webhook`
3. Enable the Teams channel
4. Set `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_APP_TENANT_ID`
5. Create a Teams app manifest and sideload or publish to your org
6. Requires M365 license for testing

### WhatsApp -- *Coming Soon*

1. Set up a Meta Business account and WhatsApp Business API
2. Configure webhook URL: `https://<your-domain>/whatsapp/webhook`
3. The webhook endpoint handles both GET (verification) and POST (messages)

### GitHub

1. Create a GitHub App or use a PAT
2. Set webhook URL: `https://<your-domain>/github/webhook`
3. Set `GITHUB_TOKEN` (or `GITHUB_APP_ID` + `GITHUB_PRIVATE_KEY`), `GITHUB_WEBHOOK_SECRET`

### Linear

1. Create an OAuth app or use a personal API key
2. Set webhook URL: `https://<your-domain>/linear/webhook`
3. Set `LINEAR_API_KEY` (personal) or `LINEAR_CLIENT_ID` + `LINEAR_CLIENT_SECRET` (OAuth)
4. Set `LINEAR_WEBHOOK_SECRET` (from webhook creation) and `LINEAR_BOT_USERNAME`

### iMessage -- *Coming Soon*

1. Requires macOS with Messages app access
2. Configure webhook URL: `https://<your-domain>/imessage/webhook`
3. Uses `chat-adapter-imessage` package

### MCP (Model Context Protocol)

Foreman exposes an MCP endpoint at `/mcp/*` automatically via Mastra. Connect from Claude Code, ChatGPT, or any MCP-compatible client:

```bash
# Claude Code
claude --mcp-server http://localhost:4111/mcp
```

### A2A (Agent-to-Agent)

Other Mastra agents can call Foreman directly:

```bash
curl -X POST http://localhost:4111/a2a/foreman \
  -H "Content-Type: application/json" \
  -d '{"message": "List my connected apps"}'
```

## API Endpoints

### Agent Server (`:4111`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents` | List registered agents |
| `POST` | `/a2a/foreman` | Agent-to-agent protocol |
| `GET` | `/mcp/*` | Model Context Protocol |
| `POST` | `/api/conversations` | Create conversation |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get conversation with messages |
| `POST` | `/api/conversations/:id/messages` | Send message (SSE stream) |
| `PATCH` | `/api/proposals/:id` | Update proposal |
| `POST` | `/api/proposals/:id/approve` | Approve action proposal |
| `POST` | `/api/proposals/:id/decline` | Decline action proposal |
| `GET` | `/api/proposals/:id/field-choices/:fieldKey` | Get dynamic field options |
| `GET` | `/capabilities` | List current user's capability flags |
| `PUT` | `/capabilities/:capability` | Set a capability flag (`{ "enabled": bool }`) |
| `GET` | `/workflows` | List user's saved workflows |
| `GET` | `/workflows/:id` | Get workflow with steps |
| `POST` | `/workflows/:id/run` | Start a workflow run (SSE stream) |
| `GET` | `/workflows/:id/runs` | List past runs for a workflow |
| `POST` | `/api/voice/transcribe` | Speech-to-text (multipart audio upload) |
| `POST` | `/api/voice/synthesize` | Text-to-speech (text → audio response) |
| `GET` | `/api/guardrails/status` | Get current guardrail settings |
| `PUT` | `/api/guardrails/app-access/:appKey` | Update sensitive app access |

### Webhook Server (`:4112`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/slack/webhook` | Slack events |
| `POST` | `/telegram/webhook` | Telegram updates |
| `POST` | `/discord/webhook` | Discord interactions |
| `POST` | `/teams/webhook` | Teams activities |
| `POST` | `/gchat/webhook` | Google Chat events |
| `POST/GET` | `/whatsapp/webhook` | WhatsApp (POST=messages, GET=verification) |
| `POST` | `/github/webhook` | GitHub events |
| `POST` | `/linear/webhook` | Linear events |
| `POST` | `/imessage/webhook` | iMessage events |
| `GET` | `/health` | Health check |

## Database

Foreman uses SQLite locally via [Drizzle ORM](https://orm.drizzle.team) + [@libsql/client](https://github.com/tursodatabase/libsql-client-ts). For production, swap `DATABASE_URL` to a [Turso](https://turso.tech) hosted URL --- same driver, no code changes.

### Tables

| Table | Purpose |
|-------|---------|
| `user` | User accounts (synced from Clerk) |
| `session` | Active sessions |
| `account` | OAuth provider links |
| `verification` | Email verification tokens |
| `zapier_identity` | Per-user Zapier OAuth tokens (encrypted) |
| `conversation` | Chat conversations |
| `message` | Conversation messages |
| `action_proposal` | Pending/approved/declined action proposals |
| `action_run` | Executed action results |
| `workflow` | Saved workflows (from conversation patterns) |
| `workflow_step` | Steps within workflows |
| `workflow_run` | Workflow execution history |
| `capability_flag` | Per-user feature flags |
| `channel_identity` | Maps channel users (Slack ID, Discord ID, etc.) to Foreman users |
| `api_key` | API keys for MCP/A2A access (`fmn_` prefixed, SHA-256 hashed) |

### Migrations

```bash
cd packages/agents

# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```

## Deployment

### Deployment Targets

| Component | Target | Notes |
|-----------|--------|-------|
| Web frontend | Vercel | Standard Next.js deployment |
| Agent server API | Vercel or VPS | Vercel uses `VercelDeployer({ studio: true, maxDuration: 300 })` |
| Webhook server + Discord Gateway | VPS | Long-running processes, not suited for serverless |

**Important:** SQLite is ephemeral on Vercel's filesystem. For Vercel deployments, use [Turso](https://turso.tech) (hosted LibSQL) by setting `DATABASE_URL` to a Turso URL --- same driver, no code changes.

### VPS

The agent server is a standard Node.js process. Deploy with PM2, systemd, or Docker.

```bash
cd packages/agents
npm run build          # mastra build
npm run start          # node .mastra/output/index.mjs
npm run start:webhooks # Webhook server (separate process)
```

### Vercel

```bash
cd packages/agents
DEPLOY_TARGET=vercel npm run build:vercel
```

When deployed to Vercel with `studio: true`, Mastra Studio is available at the deployed URL for browsing agents, testing conversations, and viewing traces in production.

### Cloudflare Workers

```bash
cd packages/agents
DEPLOY_TARGET=cloudflare npm run build:cloudflare
```

## Models

| Agent | Model | Purpose |
|-------|-------|---------|
| Foreman (primary) | `claude-sonnet-4-6` | Main conversation + tool calling |
| Discovery | `claude-haiku-4-5` | Fast app/action discovery |
| Execution | `claude-sonnet-4-6` | Action execution with validation |
| History | `claude-haiku-4-5` | Fast history search |
| Supervisor | `claude-sonnet-4-6` | Multi-agent coordination |
| Title generation | `claude-haiku-4-5` | Conversation title extraction |

## Security

- **Token encryption**: Zapier OAuth tokens are encrypted at rest with AES-256-GCM
- **PII redaction**: Output processor strips emails, API keys, phone numbers, card numbers, SSNs
- **API key hashing**: Keys are SHA-256 hashed, never stored in plaintext
- **Signature verification**: Slack, Discord, and other webhooks verify request signatures
- **Session validation**: Clerk JWT tokens verified via JWKS on every API call
- **Input validation**: Zod schemas on all API inputs

## Development

### Testing

Foreman has three layers of testing: unit tests, integration tests, and E2E tests.

#### Unit Tests (Vitest)

Located in `packages/agents/tests/unit/`. Run with:

```bash
cd packages/agents && npm test
```

| Test File | What It Tests |
|-----------|---------------|
| `crypto.test.ts` | AES-256-GCM token encryption/decryption |
| `env.test.ts` | Environment variable validation |
| `zapier-errors.test.ts` | Zapier SDK error classification and retry logic |
| `mastra-agent.test.ts` | Agent initialization, tool registration, model routing |
| `model-routing.test.ts` | Model selection (sonnet/haiku/opus per agent role) |
| `pii-redactor.test.ts` | Output processor: email, API key, phone, card, SSN redaction |
| `context-injector.test.ts` | Input processor: connected apps context injection |
| `prompt-template.test.ts` | Dynamic system prompt generation |
| `stream-types.test.ts` | SSE stream encoding and type safety |
| `telegram-bot.test.ts` | Telegram bot initialization and handler wiring |

#### Integration Tests

Located in `packages/agents/tests/integration/`:

```bash
cd packages/agents && npm test -- tests/integration
```

| Test File | What It Tests |
|-----------|---------------|
| `protocols.test.ts` | REST API, A2A, and MCP protocol endpoints |

#### E2E Tests (Playwright)

Located in `packages/web/tests/e2e/`. Tests the full user flow through the web UI:

```bash
cd packages/web && npx playwright test
```

| Test File | What It Tests |
|-----------|---------------|
| `smoke.spec.ts` | Sign up, sign in, create chat, send message, receive response |

#### AIMock (Deterministic AI Testing)

Foreman uses [`@copilotkit/aimock`](https://aimock.copilotkit.dev) for comprehensive mock infrastructure. It replaces real API calls with predictable, fixture-driven responses — not just LLMs, but voice, MCP, A2A, and more.

| Mock | What it covers |
|------|---------------|
| **LLM** | Claude, OpenAI, Gemini — chat completions with streaming |
| **Multimedia** | Whisper transcription, TTS synthesis |
| **MCP** | Tool definitions, resources, prompts |
| **A2A** | Agent cards, message routing, SSE streaming |
| **Vector** | Embedding responses for RAG pipeline |

Test fixtures are in `packages/agents/tests/fixtures/aimock/`. Config in `aimock.json`.

```bash
# Start agent server with AIMock (all APIs mocked)
cd packages/agents && npm run dev:mock

# Or run aimock standalone
npx @copilotkit/aimock --config aimock.json --port 4010
```

Useful for:
- Running tests in CI without API keys
- Reproducing specific conversation flows
- Testing tool-calling sequences deterministically
- Voice testing without hitting OpenAI/ElevenLabs
- Chaos testing (error injection, mid-stream disconnects)

### Local Tunnel (ngrok)

For testing channel webhooks locally:

```bash
ngrok http 4112
# Update webhook URLs in platform developer portals
```

Channels that need ngrok for local testing:
- **Slack** — Event Subscriptions URL
- **Telegram** — Webhook URL (or use polling mode instead)
- **Discord** — Interactions Endpoint URL (Gateway handles messages without ngrok)
- **Google Chat** — App webhook URL
- **Teams** — Messaging endpoint
- **Linear** — Webhook URL
- **GitHub** — Webhook URL

## Tech Stack

| Layer | Technology |
|-------|------------|
| Agent framework | [Mastra](https://mastra.ai) |
| Chat channels | [Vercel Chat SDK](https://chat-sdk.dev) |
| LLM | Claude (Anthropic) via Mastra |
| Embeddings | OpenAI (text-embedding-3-small) |
| Voice TTS | [ElevenLabs](https://elevenlabs.io) (primary) + OpenAI TTS (fallback) |
| Database | SQLite / LibSQL (Turso for cloud) |
| ORM | Drizzle |
| Auth | Clerk + @mastra/auth-clerk |
| Frontend | Next.js 16, React, Tailwind |
| API layer | Hono (via Mastra server) |
| Automation | Zapier SDK |
| Secrets | Infisical |

## License

MIT License. Copyright (c) 2026 Otaku Solutions.
