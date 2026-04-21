# Foreman

> **Alpha** — This project is in active development. Self-hostable today, cloud version coming soon.
> Questions? Reach out at **tylan@otakusolutions.io**

An AI assistant that takes actions across 9,000+ apps on your behalf via Zapier. Tell it what you want done in plain language — it figures out which app and action to use, shows you what it plans to do (human-in-the-loop approval), and executes it.

Built with [Mastra](https://mastra.ai) for agentic AI and [Chat SDK](https://chat-sdk.dev) for multi-channel delivery. Foreman is accessible from a web UI, Slack, Telegram, Discord, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, and iMessage --- all powered by the same agent backend. It remembers your preferences, connected apps, and past actions across all channels.

## Try It — 5 Things to Test

| # | What to say | What Foreman does |
|---|------------|-------------------|
| 1 | "What apps do I have connected?" | Lists your connected Zapier apps (e.g., Gmail, Slack, Trello) |
| 2 | "Send an email to test@example.com saying the project is complete" | Finds Gmail's send action, shows you the draft for approval, then sends it |
| 3 | "Create a Trello card called 'Follow up with client' in my To Do list" | Discovers Trello actions, gets board/list options, creates the card after approval |
| 4 | "What actions can I do with Slack?" | Lists all available Slack actions (send message, create channel, etc.) |
| 5 | "Search my recent emails for anything about invoices" | Uses Gmail's search to find matching emails and returns the results |

Works from **any channel** — web, Discord, Slack, Telegram, or MCP. Same user = same memory across channels.

### First-Time Users (No Zapier Connected)

If you haven't connected Zapier yet, just ask Foreman to do something — it will automatically detect that you're not connected and provide a one-click link to connect your Zapier account. The flow:

1. You: "Send an email to john@example.com"
2. Foreman: "You haven't connected Zapier yet. Click here to connect: [link]"
3. You click the link → Zapier OAuth in your browser → done
4. You: "Now send that email" → Foreman executes it

This works from any channel — web, Discord, Slack, Telegram, MCP, etc.

## Architecture

```
foreman/
├── packages/
│   ├── agents/          # Standalone Mastra/Hono agent server (:4111)
│   │   ├── src/
│   │   │   ├── mastra/
│   │   │   │   ├── index.ts              # Mastra instance, server config, auth, observability
│   │   │   │   ├── agents/
│   │   │   │   │   ├── foreman.ts        # Primary agent (MCP tools, memory, processors, evals)
│   │   │   │   │   ├── supervisor.ts     # Multi-agent supervisor
│   │   │   │   │   ├── discovery.ts      # App discovery subagent (Haiku)
│   │   │   │   │   ├── execution.ts      # Action execution subagent (Sonnet)
│   │   │   │   │   └── history.ts        # History search subagent (Haiku)
│   │   │   │   └── tools/                # 3 custom tools (connect_zapier, search_history, fork_conversation)
│   │   │   ├── lib/
│   │   │   │   ├── zapier/               # SDK wrapper, discovery, execution, errors, connect
│   │   │   │   ├── zapier-sdk-tools.ts   # Direct SDK import → auto-generated Mastra tools + toModelOutput + requireApproval
│   │   │   │   ├── db/                   # Drizzle ORM schema + connection (Postgres/pgvector via Supabase)
│   │   │   │   ├── stream/              # SSE encoding, chunk transformer, types
│   │   │   │   ├── processors/          # Input (context injection) + Output (PII redaction)
│   │   │   │   ├── rag/                 # Action history indexing + semantic search
│   │   │   │   ├── identity.ts          # Channel-agnostic user resolution
│   │   │   │   ├── crypto.ts            # Token encryption (AES-256-GCM)
│   │   │   │   ├── env.ts              # Environment validation
│   │   │   │   ├── proposals.ts         # Action proposal DB access
│   │   │   │   ├── prompt-template.ts   # Dynamic system prompt builder
│   │   │   │   └── api-auth.ts          # Auth middleware
│   │   │   ├── routes/                  # Hono API routes
│   │   │   │   ├── conversations.ts     # CRUD + SSE streaming (savePerStep, prepareStep)
│   │   │   │   ├── proposals.ts         # Approve/decline/field-choices
│   │   │   │   ├── middleware.ts        # Clerk JWT auth middleware
│   │   │   │   ├── webhooks.ts          # Channel webhook routes
│   │   │   │   └── zapier-connect.ts    # OAuth flow for non-web channels
│   │   │   ├── workflows/               # Mastra workflows
│   │   │   │   ├── daily-summary.ts     # Cron: 24h activity digest
│   │   │   │   ├── health-check.ts      # Cron: Zapier connection health
│   │   │   │   └── webhook-handler.ts   # HTTP trigger workflow
│   │   │   ├── discord/bot.ts           # Discord adapter (Chat SDK + Gateway)
│   │   │   ├── slack/bot.ts             # Slack adapter (Chat SDK)
│   │   │   ├── telegram/bot.ts          # Telegram adapter (Chat SDK)
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
│       │   ├── app/                     # Pages: chat, sign-in, sign-up, workflows
│       │   ├── components/              # Chat shell, approval cards, message components, voice
│       │   └── lib/
│       │       ├── api-client.ts        # Calls agent server via NEXT_PUBLIC_AGENT_SERVER_URL
│       │       └── types.ts             # Shared types
│       ├── package.json
│       └── tsconfig.json
├── package.json             # Workspace root (npm workspaces)
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

## Features

### Tools — Zapier SDK (Direct Import)

Foreman gets its Zapier capabilities by importing `@zapier/zapier-sdk` directly and generating Mastra tools from its internal registry. The `generateZapierTools()` function calls `sdk.getRegistry({ package: "mcp" })` to get the same function list the MCP server uses internally, then wraps each as a `createTool()` instance — no child process, no MCP transport layer. This provides 34 tools covering actions, apps, connections, tables, and authenticated HTTP (5 deprecated methods are excluded).

**Dynamic tool search (ToolSearchProcessor):** With 34 SDK tools, loading all schemas into every request wastes ~6-8K tokens. Instead, Foreman uses `ToolSearchProcessor` from `@mastra/core/processors` — the agent receives `search_tools` and `load_tool` meta-tools to discover and load only the tools it needs per request (top 8 results, min score 0.1).

**toModelOutput:** Each tool result passes through a summarizer that compresses verbose API responses before they reach the model — capping lists at 20 items, stripping unnecessary fields, and trimming long strings.

**Auto-pagination:** List methods (`listActions`, `listApps`, `listConnections`, etc.) auto-paginate up to 100 items by default via the SDK's `maxItems` parameter.

**Error handling:** Typed error classes from the SDK (`ZapierAuthenticationError`, `ZapierRateLimitError`, `ZapierNotFoundError`, etc.) with automatic retry (3 retries, 30s max delay). Debug mode (`FOREMAN_MODE=dev` or `DEBUG=true`) enables verbose SDK logging.

**requireApproval:** 9 write/delete tools require human approval before execution:
`run-action`, `fetch`, `create-table`, `delete-table`, `create-table-records`, `update-table-records`, `delete-table-records`, `create-table-fields`, `delete-table-fields`

**Custom tools (always loaded, not behind search):**

| Tool | Description |
|------|-------------|
| `connect_zapier` | Generate a one-time Zapier connect URL for non-web channels |
| `search_history` | Semantic search across past action results |
| `fork_conversation` | Branch a conversation for parallel exploration |

### Workspace

Foreman has a sandboxed file workspace (`./data/workspace`) via Mastra's `Workspace` API — `LocalFilesystem` for file I/O and `LocalSandbox` for command execution, with BM25 search enabled. All write operations require human approval:

| Tool | Approval Required |
|------|:-:|
| `mastra_workspace_write_file` | Yes |
| `mastra_workspace_edit_file` | Yes |
| `mastra_workspace_delete` | Yes |
| `mastra_workspace_execute_command` | Yes |

### Memory

Mastra Memory with Postgres storage (`PostgresStore` from `@mastra/pg`) and pgvector search (`PgVector` from `@mastra/pg`). Messages are stored in **Mastra threads** (not a custom message table). Each conversation maps to a `mastraThreadId`.

| Feature | Config |
|---------|--------|
| Working memory | Enabled — persistent user preferences and session context |
| Semantic recall | `topK: 2`, `messageRange: 1`, `scope: "resource"` — cross-thread recall by user |
| Observational memory | Enabled — learns from interaction patterns |
| Embedder | `openai/text-embedding-3-small` |
| Last messages | 20 |

All 9 channel bots use `savePerStep: true` so memory is persisted after each tool step, not just at the end.

### Streaming

Mastra does not provide a `toUIMessageStreamResponse` method. Foreman implements a custom SSE layer:

1. The conversations route calls `agent.stream()` with `savePerStep` and `prepareStep`
2. `prepareStep` uses the fast model (`claude-haiku-4-5`) for the first 2 tool discovery steps, then switches to the default model for reasoning
3. `createChunkTransformer` converts Mastra `fullStream` chunks into `AppChunk` SSE events (`text-delta`, `tool-call`, `proposal-created`, `action-executed`, `error`, `done`)
4. The frontend consumes these via a custom SSE client

### Processors

| Processor | Type | What It Does |
|-----------|------|-------------|
| `contextInjector` | Input | Injects connected apps context into the prompt |
| `ToolSearchProcessor` | Input | Provides `search_tools`/`load_tool` meta-tools for dynamic MCP tool loading |
| `piiRedactor` | Output | Strips emails, API keys, Bearer tokens, phones, cards, SSNs from output |

### Multi-Agent

| Agent | Model | Purpose |
|-------|-------|---------|
| Foreman (primary) | `claude-sonnet-4-6` | Main conversation + tool calling |
| Discovery | `claude-haiku-4-5-20251001` | Fast app/action discovery |
| Execution | `claude-sonnet-4-6` | Action execution with validation |
| History | `claude-haiku-4-5-20251001` | Fast history search |
| Supervisor | `claude-sonnet-4-6` | Multi-agent coordination |

### Channels

9 adapters via [Chat SDK](https://chat-sdk.dev), plus MCP and A2A protocols.

| Channel | Adapter | How It Works |
|---------|---------|-------------|
| **Web** | Next.js frontend | Clerk sessions, custom SSE streaming |
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

Foreman uses [Clerk](https://clerk.com) for user authentication.

| Auth Method | Use Case |
|-------------|----------|
| Clerk (`@clerk/nextjs`) | Web frontend sign-in/sign-up, org switching |
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

### Evals

| Scorer | Sampling |
|--------|----------|
| Answer relevancy | 30% of requests |
| Toxicity | 20% of requests |

### Workflows

Foreman can extract repeatable action sequences from conversations and save them as reusable workflows.

- **Management UI** at `/workflows` in the web frontend
- **SSE streaming** for real-time run status updates (step-by-step progress)
- **Run history** tracking with success/failure status
- Workflows are scoped per-user and linked to their source conversation

API: `GET /workflows`, `GET /workflows/:id`, `POST /workflows/:id/run` (SSE stream), `GET /workflows/:id/runs`

### Voice I/O

Foreman supports voice input and output, controllable per-user via the `voice` capability flag.

- **Speech-to-Text**: OpenAI Whisper via `@mastra/voice-openai`
- **Text-to-Speech**: ElevenLabs (`@mastra/voice-elevenlabs`, primary) with OpenAI TTS fallback
- **Web UI**: Mic button next to chat input, speaker icon on agent messages

API: `POST /api/voice/transcribe` (multipart audio upload), `POST /api/voice/synthesize` (text → audio response)

### Guardrails

| Guardrail | Description | Default |
|-----------|-------------|---------|
| **Rate limiting** | Per-user sliding window (30/min, 200/hour) | Enabled |
| **Action risk assessment** | Classifies actions as low/medium/high/critical | Enabled |
| **Sensitive app blocking** | Banking, HR, security apps require opt-in | Blocked by default |
| **Bulk confirmation** | Requires approval for operations affecting >5 records | Enabled |
| **Org admin controls** | Org admins can override guardrail settings for all members | Configurable |
| **PII redaction** | Strips emails, API keys, phones, cards, SSNs from output | Always on |

## Foreman Modes

Foreman supports three operating modes, set via `FOREMAN_MODE` in `.env.local`:

| Mode | Value | Description |
|------|-------|-------------|
| **Dev** | `dev` (default) | Uses your personal Zapier CLI login. No client credentials needed. Best for local development. |
| **Production** | `production` | Multi-tenant: each user connects their own Zapier account via OAuth. Requires `ZAPIER_CLIENT_ID` and `ZAPIER_CLIENT_SECRET`. |
| **Self-Hosted** | `self_hosted` | Uses shared Zapier client credentials for all users (single account). Ideal for personal/team deployments where everyone shares one Zapier connection. |

## Zapier Configuration

Foreman uses the [Zapier SDK](https://docs.zapier.com/sdk) (`@zapier/zapier-sdk`) to execute actions across 9,000+ apps. Foreman imports the SDK directly and generates Mastra tools from its internal registry — the same function list the MCP server uses, without the transport layer. No child process or stdio needed.

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
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54422/postgres  # local Supabase
ENCRYPTION_KEY=<64-char hex string>
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...              # For embeddings and voice STT
AGENT_SERVER_URL=http://localhost:4111  # Used for Zapier OAuth callback URLs

# Auth (Clerk)
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Zapier
FOREMAN_MODE=dev                        # "dev", "production", or "self_hosted"
ZAPIER_CLIENT_ID=...                    # From: npx zapier-sdk create-client-credentials "name"
ZAPIER_CLIENT_SECRET=...

# Channels (add only what you need)
TELEGRAM_BOT_TOKEN=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
CRON_SECRET=...                         # Required for Discord Gateway
GOOGLE_CHAT_CREDENTIALS=...             # Service account JSON (single line)
GITHUB_TOKEN=...
GITHUB_WEBHOOK_SECRET=...
LINEAR_API_KEY=lin_api_...
LINEAR_WEBHOOK_SECRET=lin_wh_...
LINEAR_BOT_USERNAME=...

# Voice (optional — falls back to OpenAI TTS if ElevenLabs not set)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...                 # Defaults to "Rachel"
```

**`packages/web/.env.local`:**

```bash
NEXT_PUBLIC_AGENT_SERVER_URL=http://localhost:4111
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### 3. Start local Supabase & run database migrations

Foreman uses a local Supabase instance (Postgres + pgvector) for development. Ports are shifted +100 to avoid colliding with other Supabase projects on the same machine.

```bash
# Boots Postgres (:54422), API (:54421), Studio (:54423)
npx supabase start

# Apply schema (includes CREATE EXTENSION vector)
cd packages/agents
npx drizzle-kit migrate
```

Studio UI: http://127.0.0.1:54423 · Stop with `npx supabase stop`.

> `supabase/config.toml` disables storage, auth, realtime, inbucket, analytics, and edge_runtime — Foreman doesn't use them, and they fail health checks on Windows.

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

### WhatsApp -- *Coming Soon*

1. Set up a Meta Business account and WhatsApp Business API
2. Configure webhook URL: `https://<your-domain>/whatsapp/webhook`

### GitHub

1. Create a GitHub App or use a PAT
2. Set webhook URL: `https://<your-domain>/github/webhook`
3. Set `GITHUB_TOKEN` (or `GITHUB_APP_ID` + `GITHUB_PRIVATE_KEY`), `GITHUB_WEBHOOK_SECRET`

### Linear

1. Create an OAuth app or use a personal API key
2. Set webhook URL: `https://<your-domain>/linear/webhook`
3. Set `LINEAR_API_KEY` (personal) or `LINEAR_CLIENT_ID` + `LINEAR_CLIENT_SECRET` (OAuth)
4. Set `LINEAR_WEBHOOK_SECRET` and `LINEAR_BOT_USERNAME`

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
| `POST` | `/api/conversations` | Create conversation (creates Mastra thread) |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get conversation with messages (from Mastra Memory thread) |
| `POST` | `/api/conversations/:id/messages` | Send message (SSE stream with savePerStep + prepareStep) |
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

Foreman uses **Postgres with pgvector** via [Drizzle ORM](https://orm.drizzle.team) (dialect: `postgresql`, driver: [`postgres-js`](https://github.com/porsager/postgres)). Mastra storage and vector search use `PostgresStore` and `PgVector` from [`@mastra/pg`](https://mastra.ai/docs).

Local development uses the [Supabase CLI](https://supabase.com/docs/guides/cli) to run Postgres + pgvector in Docker. Production can use hosted Supabase, Neon, or any Postgres provider with the `vector` extension.

**Local:** `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54422/postgres`
**Production:** `DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>`

The initial migration (`drizzle/0000_init.sql`) prepends `CREATE EXTENSION IF NOT EXISTS vector` so pgvector is enabled before any vector columns are created.

### Tables

| Table | Purpose |
|-------|---------|
| `user` | User accounts (synced from Clerk) |
| `session` | Active sessions (legacy, kept for migration compatibility) |
| `account` | OAuth provider links |
| `verification` | Email verification tokens |
| `zapier_identity` | Per-user Zapier OAuth tokens (encrypted) |
| `conversation` | Chat conversations (links to `mastraThreadId` for memory) |
| `message` | Conversation messages (legacy — messages primarily stored in Mastra threads) |
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

### Live URLs

| Component | URL | Platform |
|-----------|-----|----------|
| Web frontend | https://foreman.otakusolutions.io | Vercel |
| Agent server | https://foreman-agents.otakusolutions.io | Coolify (Hostinger VPS) |

### Architecture

| Component | Target | Why |
|-----------|--------|-----|
| Web frontend | **Vercel** | Standard Next.js deployment, Clerk auth, static + dynamic pages |
| Agent server | **VPS (Coolify)** | Streaming conversations need long-running connections |
| Agent server | **Vercel** (alternative) | Viable with hosted Postgres (Supabase/Neon). Build with `npm run build:vercel`. |
| Webhook server | **VPS (Coolify)** | Discord Gateway WebSocket + channel webhooks need persistent processes |

**Deployment flexibility:** The agent server uses a direct SDK import (no child processes or stdio transport), making it deployable to Vercel, Cloudflare Workers, or any VPS. Database-wise, any Postgres provider with the `vector` extension (Supabase, Neon, RDS, etc.) works — just point `DATABASE_URL` at it.

### VPS (Coolify)

The agent server runs as a Docker container managed by Coolify. Coolify app UUID: `oqshe32xh3v8zva7tt6r4aff`.

**Dockerfile** (`Dockerfile.agents`): Multi-stage build with `node:22-slim`. Stage 1 installs all deps (dev included for `mastra build`), runs `npx mastra build`. Stage 2 copies `.mastra/output/` and `node_modules/` to a clean image. Postgres is provided externally (hosted Supabase/Neon or a sibling container) — point `DATABASE_URL` at it.

```bash
# Manual VPS deploy (without Coolify)
cd packages/agents
npm run build          # mastra build
npm run start          # node .mastra/output/index.mjs
npm run start:webhooks # Webhook server (separate process)
```

### Vercel (Web Frontend)

Configured via `vercel.json`:

```bash
npx vercel --prod      # Deploy to production
npx vercel env ls      # List env vars
```

Required env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_AGENT_SERVER_URL`

## Security

### Input Validation & Sanitization

- **Zod schemas** on every route — type-safe validation with descriptive error messages
- **JSON parse protection** — malformed request bodies return 400, never crash the server
- **Length limits** — message content (50KB max), voice text (10KB max), file uploads (25MB max)
- **Parameter validation** — all URL params checked for existence and format
- **SQL injection prevention** — Drizzle ORM uses parameterized queries (no raw SQL)

### Output Sanitization

- **PII redaction** — output processor strips emails, API keys, Bearer tokens, phone numbers, credit card numbers, and SSNs before responses leave the system

### Authentication & Encryption

- **Clerk JWT verification** — JWKS-based token validation via `@mastra/auth-clerk` on every API call
- **Token encryption** — Zapier OAuth tokens encrypted at rest with AES-256-GCM
- **API key hashing** — keys are SHA-256 hashed, never stored in plaintext
- **Webhook signatures** — Slack, Discord, Linear, and other webhooks verify request signatures
- **requireApproval** — 10 write/delete MCP tools require human approval before execution
- **Guardrails** — rate limiting, sensitive app blocking, bulk operation confirmation

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
| `capabilities.test.ts` | Feature flags CRUD, default-on behavior |
| `context-injector.test.ts` | Input processor: connected apps context injection |
| `cross-channel-memory.test.ts` | Cross-channel memory recall (same user, different platforms) |
| `crypto.test.ts` | AES-256-GCM token encryption/decryption |
| `env.test.ts` | Environment variable validation |
| `guardrails.test.ts` | Rate limiting, risk assessment, sensitive app blocking, bulk confirmation |
| `guardrails-config.test.ts` | Org-level guardrail defaults and configuration |
| `identity.test.ts` | Clerk JWT parsing, orgId extraction, API key resolution, channel identity |
| `mastra-agent.test.ts` | Agent initialization, tool registration, model routing |
| `model-routing.test.ts` | Model selection (sonnet/haiku/opus per agent role) |
| `pii-redactor.test.ts` | Output processor: email, API key, phone, card, SSN redaction |
| `prompt-template.test.ts` | Dynamic system prompt generation |
| `stream-types.test.ts` | SSE stream encoding and type safety |
| `telegram-bot.test.ts` | Telegram bot initialization and handler wiring |
| `voice.test.ts` | STT/TTS functions, ElevenLabs primary, OpenAI fallback |
| `zapier-errors.test.ts` | Zapier SDK error classification and retry logic |
| `zapier-mcp.test.ts` | MCP client creation, toModelOutput summarizers, requireApproval mapping |

#### Integration Tests

Located in `packages/agents/tests/integration/`:

```bash
cd packages/agents && npm test -- tests/integration
```

| Test File | What It Tests |
|-----------|---------------|
| `api-routes.test.ts` | All API endpoints, auth gating, mock JWT |
| `protocols.test.ts` | REST API, A2A, and MCP protocol endpoints |

#### E2E Tests (Playwright)

Located in `packages/web/tests/e2e/`:

```bash
cd packages/web && npx playwright test
```

#### AIMock (Deterministic AI Testing)

Foreman uses [`@copilotkit/aimock`](https://aimock.copilotkit.dev) for mock infrastructure — LLM, voice, MCP, A2A, and vector DB mocking with fixture-driven responses.

```bash
# Start agent server with AIMock (all APIs mocked)
cd packages/agents && npm run dev:mock

# Or run aimock standalone
npx @copilotkit/aimock --config aimock.json --port 4010
```

### Linting & Formatting

```bash
npm run lint           # biome check .
npm run lint:fix       # biome check --fix .
npm run format         # biome format --write .
```

### Local Tunnel (ngrok)

For testing channel webhooks locally:

```bash
ngrok http 4112
# Update webhook URLs in platform developer portals
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Agent framework | [Mastra](https://mastra.ai) (`@mastra/core`, `@mastra/memory`, `@mastra/mcp`, `@mastra/evals`) |
| Chat channels | [Chat SDK](https://chat-sdk.dev) (`chat`, `@chat-adapter/*`) |
| Zapier integration | `@zapier/zapier-sdk` (direct import, 34 auto-generated tools) |
| LLM | Claude (Anthropic) via Mastra |
| Embeddings | OpenAI (`text-embedding-3-small`) |
| Voice TTS | [ElevenLabs](https://elevenlabs.io) (`@mastra/voice-elevenlabs`) + OpenAI TTS (`@mastra/voice-openai`) fallback |
| Database | Postgres + [pgvector](https://github.com/pgvector/pgvector) (local via [Supabase CLI](https://supabase.com/docs/guides/cli); hosted via Supabase/Neon/RDS) |
| ORM | [Drizzle](https://orm.drizzle.team) (`postgres-js` driver) |
| Mastra storage/vector | `@mastra/pg` (`PostgresStore`, `PgVector`) |
| Auth | [Clerk](https://clerk.com) (`@clerk/nextjs` + `@mastra/auth-clerk`) |
| Frontend | [Next.js](https://nextjs.org) 16, React 19, Tailwind 4 |
| Markdown rendering | [Streamdown](https://github.com/nichochar/streamdown) (code, math, mermaid plugins) |
| API layer | [Hono](https://hono.dev) (via Mastra server) |
| Linting | [Biome](https://biomejs.dev) |
| Testing | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), [AIMock](https://aimock.copilotkit.dev) |
| Monorepo | npm workspaces |

## License

MIT License. Copyright (c) 2026 Otaku Solutions.
