# Foreman

> **Alpha** — This project is in active development. Self-hostable today, cloud version coming soon.
> Questions? Reach out at **tylan@otakusolutions.io**

An AI assistant that takes actions across 9,000+ apps on your behalf via Zapier. Tell it what you want done in plain language — it figures out which app and action to use, shows you what it plans to do (human-in-the-loop approval), and executes it.

Built with [Mastra](https://mastra.ai) for agentic AI and [Chat SDK](https://chat-sdk.dev) for multi-channel delivery. Foreman is accessible from a web UI, Slack, Telegram, Discord, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, and iMessage --- all powered by the same agent backend. It remembers your preferences, connected apps, and past actions across all channels.

## Try It — 5 Things to Test

| #   | What to say                                                            | What Foreman does                                                                  |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | "What apps do I have connected?"                                       | Lists your connected Zapier apps (e.g., Gmail, Slack, Trello)                      |
| 2   | "Send an email to test@example.com saying the project is complete"     | Finds Gmail's send action, shows you the draft for approval, then sends it         |
| 3   | "Create a Trello card called 'Follow up with client' in my To Do list" | Discovers Trello actions, gets board/list options, creates the card after approval |
| 4   | "What actions can I do with Slack?"                                    | Lists all available Slack actions (send message, create channel, etc.)             |
| 5   | "Search my recent emails for anything about invoices"                  | Uses Gmail's search to find matching emails and returns the results                |

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
│   │   │   │   ├── db/                   # supabase-js client + TypeScript table interfaces
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
│   │   │   │   ├── middleware.ts        # Supabase JWT + API key auth middleware
│   │   │   │   ├── webhooks.ts          # Channel webhook routes
│   │   │   │   └── zapier-connect.ts    # OAuth flow for non-web channels
│   │   │   ├── workflows/               # Mastra workflows
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
│   │   ├── drizzle/                     # Legacy SQL migrations (schema managed via Supabase)
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

### Mastra Editor (`@mastra/editor`)

Foreman includes [`@mastra/editor`](https://mastra.ai/docs/editor) wired into the Mastra instance. When enabled, it provides a visual editor UI for inspecting and editing agent prompts, tool configurations, and workflow definitions at runtime — accessible at [http://localhost:4111](http://localhost:4111) alongside the standard dev playground. No additional configuration is required; it activates automatically in dev mode.

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

| Tool                | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `connect_zapier`    | Generate a one-time Zapier connect URL for non-web channels |
| `search_history`    | Semantic search across past action results                  |
| `fork_conversation` | Branch a conversation for parallel exploration              |

### Workspace

Foreman has a sandboxed file workspace (`./data/workspace`) via Mastra's `Workspace` API — `LocalFilesystem` for file I/O and `LocalSandbox` for command execution, with BM25 search enabled. All write operations require human approval:

| Tool                               | Approval Required |
| ---------------------------------- | :---------------: |
| `mastra_workspace_write_file`      |        Yes        |
| `mastra_workspace_edit_file`       |        Yes        |
| `mastra_workspace_delete`          |        Yes        |
| `mastra_workspace_execute_command` |        Yes        |

### Memory

Mastra Memory with Postgres storage (`PostgresStore` from `@mastra/pg`) and pgvector search (`PgVector` from `@mastra/pg`). Messages are stored in **Mastra threads** (not a custom message table). Each conversation maps to a `mastraThreadId`.

| Feature              | Config                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| Working memory       | Enabled — persistent user preferences and session context                       |
| Semantic recall      | `topK: 2`, `messageRange: 1`, `scope: "resource"` — cross-thread recall by user |
| Observational memory | Enabled — learns from interaction patterns                                      |
| Embedder             | `openai/text-embedding-3-small`                                                 |
| Last messages        | 20                                                                              |

All 9 channel bots use `savePerStep: true` so memory is persisted after each tool step, not just at the end.

### Streaming

Mastra does not provide a `toUIMessageStreamResponse` method. Foreman implements a custom SSE layer:

1. The conversations route calls `agent.stream()` with `savePerStep` and `prepareStep`
2. `prepareStep` uses the fast model (`claude-haiku-4-5`) for the first 2 tool discovery steps, then switches to the default model for reasoning
3. `createChunkTransformer` converts Mastra `fullStream` chunks into `AppChunk` SSE events (`text-delta`, `tool-call`, `proposal-created`, `action-executed`, `error`, `done`)
4. The frontend consumes these via a custom SSE client

### Processors

| Processor             | Type   | What It Does                                                                |
| --------------------- | ------ | --------------------------------------------------------------------------- |
| `contextInjector`     | Input  | Injects connected apps context into the prompt                              |
| `ToolSearchProcessor` | Input  | Provides `search_tools`/`load_tool` meta-tools for dynamic MCP tool loading |
| `piiRedactor`         | Output | Strips emails, API keys, Bearer tokens, phones, cards, SSNs from output     |

### Multi-Agent

| Agent             | Model                       | Purpose                          |
| ----------------- | --------------------------- | -------------------------------- |
| Foreman (primary) | `claude-sonnet-4-6`         | Main conversation + tool calling |
| Discovery         | `claude-haiku-4-5-20251001` | Fast app/action discovery        |
| Execution         | `claude-sonnet-4-6`         | Action execution with validation |
| History           | `claude-haiku-4-5-20251001` | Fast history search              |
| Supervisor        | `claude-sonnet-4-6`         | Multi-agent coordination         |

### Channels

9 adapters via [Chat SDK](https://chat-sdk.dev), plus MCP and A2A protocols.

| Channel             | Adapter                  | How It Works                                         |
| ------------------- | ------------------------ | ---------------------------------------------------- |
| **Web**             | Next.js frontend         | Supabase sessions, custom SSE streaming              |
| **Slack**           | `@chat-adapter/slack`    | Webhook on `:4112/slack/webhook`                     |
| **Telegram**        | `@chat-adapter/telegram` | Webhook or polling mode                              |
| **Discord**         | `@chat-adapter/discord`  | Gateway WebSocket + Interactions endpoint            |
| **Microsoft Teams** | `@chat-adapter/teams`    | Webhook on `:4112/teams/webhook` -- _Coming Soon_    |
| **Google Chat**     | `@chat-adapter/gchat`    | Webhook on `:4112/gchat/webhook`                     |
| **WhatsApp**        | `@chat-adapter/whatsapp` | Webhook on `:4112/whatsapp/webhook` -- _Coming Soon_ |
| **GitHub**          | `@chat-adapter/github`   | Webhook on `:4112/github/webhook`                    |
| **Linear**          | `@chat-adapter/linear`   | Webhook on `:4112/linear/webhook`                    |
| **iMessage**        | `chat-adapter-imessage`  | Webhook on `:4112/imessage/webhook` -- _Coming Soon_ |
| **MCP**             | Mastra built-in          | `GET /mcp/*` (Claude Code, ChatGPT, etc.)            |
| **A2A**             | Mastra built-in          | `POST /a2a/foreman` (agent-to-agent)                 |

### Authentication

Foreman uses [Supabase Auth](https://supabase.com/docs/guides/auth) for all authentication — both the web frontend and the agent server.

| Auth Method                                                 | Use Case                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Supabase Auth (`@supabase/ssr`)                             | Web frontend sign-in/sign-up (email, magic link, OAuth)       |
| Supabase JWT (`supabase.auth.getUser(token)`)               | Agent server validates session tokens on every request        |
| API key (`x-api-key` header, `fmn_` prefix, SHA-256 hashed) | MCP, A2A, programmatic access                                 |
| Channel identity                                            | Auto-registered per platform (Slack, Discord, Telegram, etc.) |

Users from chat channels get auto-created Foreman accounts. Multiple channel identities can be linked to a single user.

### Workspaces (Multi-Tenant)

Foreman supports multi-tenant workspaces for team deployments:

- Workspace membership, roles, and permissions are managed via the `workspaces` and `workspace_members` tables
- Zapier connections and conversations can be scoped per workspace
- Workspace admins can configure guardrail defaults for all members

### Capabilities

Per-user feature flags that control what actions the agent can perform. All capabilities default to **enabled**.

| Capability | Description                          |
| ---------- | ------------------------------------ |
| `search`   | Search/discover apps and actions     |
| `read`     | Read data from connected apps        |
| `write`    | Write/create data in connected apps  |
| `execute`  | Execute actions (with approval flow) |
| `raw_api`  | Direct Zapier API calls              |

Manage via `GET /capabilities` (list all) and `PUT /capabilities/:capability` (set `{ "enabled": true/false }`).

### Evals

| Scorer           | Sampling        |
| ---------------- | --------------- |
| Answer relevancy | 30% of requests |
| Toxicity         | 20% of requests |

### Workflows

Foreman can extract repeatable action sequences from conversations and save them as reusable workflows.

- **Management UI** at `/workflows` in the web frontend
- **SSE streaming** for real-time run status updates (step-by-step progress)
- **Run history** tracking with success/failure status
- Workflows are scoped per-user and linked to their source conversation

API: `GET /workflows`, `GET /workflows/:id`, `POST /workflows/:id/run` (SSE stream), `GET /workflows/:id/runs`

### Voice Input

Foreman supports voice input (speech-to-text) via the `voice` capability flag.

- **Speech-to-Text**: OpenAI Whisper via `@mastra/voice-openai`
- **Web UI**: Mic button next to chat input — records audio, sends to `/api/voice/transcribe`, inserts transcript into the message field

API: `POST /api/voice/transcribe` (multipart audio upload → transcript string)

### Guardrails

| Guardrail                  | Description                                                | Default            |
| -------------------------- | ---------------------------------------------------------- | ------------------ |
| **Rate limiting**          | Per-user sliding window (30/min, 200/hour)                 | Enabled            |
| **Action risk assessment** | Classifies actions as low/medium/high/critical             | Enabled            |
| **Sensitive app blocking** | Banking, HR, security apps require opt-in                  | Blocked by default |
| **Bulk confirmation**      | Requires approval for operations affecting >5 records      | Enabled            |
| **Org admin controls**     | Org admins can override guardrail settings for all members | Configurable       |
| **PII redaction**          | Strips emails, API keys, phones, cards, SSNs from output   | Always on          |

## Foreman Modes

Foreman supports three operating modes, set via `FOREMAN_MODE` in `.env.local`:

| Mode            | Value           | Description                                                                                                                                            |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dev**         | `dev` (default) | Uses your personal Zapier CLI login. No client credentials needed. Best for local development.                                                         |
| **Production**  | `production`    | Multi-tenant: each user connects their own Zapier account via OAuth. Requires `ZAPIER_CLIENT_ID` and `ZAPIER_CLIENT_SECRET`.                           |
| **Self-Hosted** | `self_hosted`   | Uses shared Zapier client credentials for all users (single account). Ideal for personal/team deployments where everyone shares one Zapier connection. |

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

# Auth (Supabase)
SUPABASE_URL=http://127.0.0.1:54421       # local; production: https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>  # from: npx supabase start
SUPABASE_ANON_KEY=<anon_key>             # from: npx supabase start

# Zapier
FOREMAN_MODE=dev                        # "dev", "production", or "self_hosted"
ZAPIER_CLIENT_ID=...                    # From: npx zapier-sdk create-client-credentials "name"
ZAPIER_CLIENT_SECRET=...

# Web URL (used for OAuth redirect URIs)
WEB_URL=http://localhost:3000           # production: https://your-domain.com

# Channels (add only what you need)
TELEGRAM_BOT_TOKEN=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CLIENT_ID=...                     # For web OAuth connect flow
SLACK_CLIENT_SECRET=...                 # For web OAuth connect flow
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
GOOGLE_CHAT_CREDENTIALS=...             # Service account JSON (single line)
GITHUB_TOKEN=...
GITHUB_WEBHOOK_SECRET=...
LINEAR_API_KEY=lin_api_...
LINEAR_WEBHOOK_SECRET=lin_wh_...
LINEAR_BOT_USERNAME=...

# Voice STT (optional — uses OpenAI Whisper, billed to OPENAI_API_KEY)
# No extra vars needed — STT uses the existing OPENAI_API_KEY above
```

**`packages/web/.env.local`:**

```bash
NEXT_PUBLIC_AGENT_SERVER_URL=http://localhost:4111

# Auth (Supabase — same project as agents)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421       # local; production: https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... # from: npx supabase start

# Channels (used by web connect UI)
NEXT_PUBLIC_SLACK_CLIENT_ID=...
NEXT_PUBLIC_DISCORD_APPLICATION_ID=...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=...
```

### 3. Start local Supabase & run database migrations

Foreman uses a local Supabase instance (Postgres + pgvector) for development. Ports are shifted +100 to avoid colliding with other Supabase projects on the same machine.

```bash
# Boots Postgres (:54422), API (:54421), Studio (:54423)
npx supabase start
```

After starting, copy the `service_role key` and `anon key` from the CLI output into `packages/agents/.env.local` as `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`.

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

**Bot credentials** (for receiving messages):

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Under **OAuth & Permissions**, add Bot Token Scopes: `chat:write`, `users:read`, `app_mentions:read`, `im:history`, `im:read`, `im:write`
3. Enable **Event Subscriptions** → Request URL: `https://<your-domain>/slack/webhook`
4. Subscribe to bot events: `app_mention`, `message.im`
5. Install to workspace → copy **Bot User OAuth Token** and **Signing Secret**
6. Set in `agents/.env.local`: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

**OAuth app credentials** (for web "Connect Slack" flow):

7. Under **OAuth & Permissions**, add a Redirect URL: `https://<your-domain>/settings/channels/slack/callback`
8. Copy **Client ID** and **Client Secret** from Basic Information
9. Set in `agents/.env.local`: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
10. Set in `web/.env.local`: `NEXT_PUBLIC_SLACK_CLIENT_ID` (same value as `SLACK_CLIENT_ID`)

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy the bot token and note the bot's **username** (e.g. `foremanHQbot`)
3. Set in `agents/.env.local`: `TELEGRAM_BOT_TOKEN`
4. Set in `web/.env.local`: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (the `@username` without the `@`)
5. **Webhook mode:** Set webhook URL to `https://<your-domain>/telegram/webhook`
6. **Polling mode:** `cd packages/agents && npx tsx src/telegram/start-polling.ts`

### Discord

1. Create an app at [discord.com/developers](https://discord.com/developers/applications)
2. Under **Bot**, copy the token; enable **Privileged Gateway Intents → Message Content Intent**
3. Under **General Information**, copy **Application ID** and **Public Key**
4. Set **Interactions Endpoint URL** to `https://<your-domain>/discord/webhook`
5. Invite bot to server: `https://discord.com/api/oauth2/authorize?client_id=<APP_ID>&permissions=2048&scope=bot`
6. Set in `agents/.env.local`: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`
7. Set in `web/.env.local`: `NEXT_PUBLIC_DISCORD_APPLICATION_ID` (same value as `DISCORD_APPLICATION_ID`)

Discord uses a Gateway WebSocket connection for receiving messages. The webhook server automatically starts the Gateway listener on boot when `DISCORD_BOT_TOKEN` is set.

### Google Chat

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Chat API
3. Create a Service Account with Chat Bot scope
4. Download the JSON key and set `GOOGLE_CHAT_CREDENTIALS` (entire JSON on one line)
5. Configure the Chat app in Google Workspace with webhook URL: `https://<your-domain>/gchat/webhook`

### Microsoft Teams -- _Coming Soon_

1. Register a bot in [Azure Portal](https://portal.azure.com) (Azure Bot resource)
2. Set messaging endpoint to `https://<your-domain>/teams/webhook`
3. Enable the Teams channel
4. Set `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_APP_TENANT_ID`
5. Create a Teams app manifest and sideload or publish to your org

### WhatsApp -- _Coming Soon_

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

### iMessage -- _Coming Soon_

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

| Method  | Path                                         | Description                                                |
| ------- | -------------------------------------------- | ---------------------------------------------------------- |
| `GET`   | `/api/agents`                                | List registered agents                                     |
| `POST`  | `/a2a/foreman`                               | Agent-to-agent protocol                                    |
| `GET`   | `/mcp/*`                                     | Model Context Protocol                                     |
| `POST`  | `/api/conversations`                         | Create conversation (creates Mastra thread)                |
| `GET`   | `/api/conversations`                         | List conversations                                         |
| `GET`   | `/api/conversations/:id`                     | Get conversation with messages (from Mastra Memory thread) |
| `POST`  | `/api/conversations/:id/messages`            | Send message (SSE stream with savePerStep + prepareStep)   |
| `PATCH` | `/api/proposals/:id`                         | Update proposal                                            |
| `POST`  | `/api/proposals/:id/approve`                 | Approve action proposal                                    |
| `POST`  | `/api/proposals/:id/decline`                 | Decline action proposal                                    |
| `GET`   | `/api/proposals/:id/field-choices/:fieldKey` | Get dynamic field options                                  |
| `GET`   | `/capabilities`                              | List current user's capability flags                       |
| `PUT`   | `/capabilities/:capability`                  | Set a capability flag (`{ "enabled": bool }`)              |
| `GET`   | `/workflows`                                 | List user's saved workflows                                |
| `GET`   | `/workflows/:id`                             | Get workflow with steps                                    |
| `POST`  | `/workflows/:id/run`                         | Start a workflow run (SSE stream)                          |
| `GET`   | `/workflows/:id/runs`                        | List past runs for a workflow                              |
| `POST`  | `/api/voice/transcribe`                      | Speech-to-text (multipart audio upload)                    |
| `POST`  | `/api/voice/synthesize`                      | Text-to-speech (text → audio response)                     |
| `GET`   | `/api/guardrails/status`                     | Get current guardrail settings                             |
| `PUT`   | `/api/guardrails/app-access/:appKey`         | Update sensitive app access                                |

### Webhook Server (`:4112`)

| Method     | Path                | Description                                |
| ---------- | ------------------- | ------------------------------------------ |
| `POST`     | `/slack/webhook`    | Slack events                               |
| `POST`     | `/telegram/webhook` | Telegram updates                           |
| `POST`     | `/discord/webhook`  | Discord interactions                       |
| `POST`     | `/teams/webhook`    | Teams activities                           |
| `POST`     | `/gchat/webhook`    | Google Chat events                         |
| `POST/GET` | `/whatsapp/webhook` | WhatsApp (POST=messages, GET=verification) |
| `POST`     | `/github/webhook`   | GitHub events                              |
| `POST`     | `/linear/webhook`   | Linear events                              |
| `POST`     | `/imessage/webhook` | iMessage events                            |
| `GET`      | `/health`           | Health check                               |

## Database

Foreman uses **Postgres with pgvector** via [supabase-js](https://supabase.com/docs/reference/javascript) for all application tables. Mastra storage and vector search use `PostgresStore` and `PgVector` from [`@mastra/pg`](https://mastra.ai/docs) (direct `DATABASE_URL` connection, separate from supabase-js).

Local development uses the [Supabase CLI](https://supabase.com/docs/guides/cli) to run Postgres + pgvector in Docker. Production can use hosted Supabase, Neon, or any Postgres provider with the `vector` extension.

**Local:** `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54422/postgres`
**Production:** `DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>`

### Tables

| Table                | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `user`               | User accounts                                                    |
| `zapier_identity`    | Per-user Zapier OAuth tokens (encrypted)                         |
| `conversation`       | Chat conversations (links to `mastraThreadId` for memory)        |
| `action_proposal`    | Pending/approved/declined action proposals                       |
| `action_run`         | Executed action results                                          |
| `workflow`           | Saved workflows (from conversation patterns)                     |
| `workflow_step`      | Steps within workflows                                           |
| `workflow_run`       | Workflow execution history                                       |
| `connection_alias`   | User-defined friendly names for Zapier connections               |
| `capability_flag`    | Per-user feature flags                                           |
| `channel_identity`   | Maps channel users (Slack ID, Discord ID, etc.) to Foreman users |
| `channel_link_code`  | Short-lived codes for linking chat channels to a Foreman account |
| `slack_installation` | Per-workspace Slack bot tokens (persisted across restarts)       |
| `app_catalog`        | Cached Zapier app metadata with embeddings for semantic search   |
| `api_key`            | API keys for MCP/A2A access (`fmn_` prefixed, SHA-256 hashed)    |

### Schema Changes

Application tables are managed via the Supabase CLI. Use Supabase Studio (`:54423`) or SQL editor to apply schema changes locally, then generate a migration:

```bash
# Generate migration from local schema changes
npx supabase db diff -f my_migration_name

# Apply all pending migrations
npx supabase db push
```

## Deployment

### Live URLs

| Component    | URL                                      | Platform                |
| ------------ | ---------------------------------------- | ----------------------- |
| Web frontend | https://foreman.otakusolutions.io        | Vercel                  |
| Agent server | https://foreman-agents.otakusolutions.io | Coolify (Hostinger VPS) |

### Architecture

| Component      | Target                   | Why                                                                             |
| -------------- | ------------------------ | ------------------------------------------------------------------------------- |
| Web frontend   | **Vercel**               | Standard Next.js deployment, Supabase auth, static + dynamic pages              |
| Agent server   | **VPS (Coolify)**        | Streaming conversations need long-running connections                           |
| Agent server   | **Vercel** (alternative) | Viable with hosted Postgres (Supabase/Neon). Build with `npm run build:vercel`. |
| Webhook server | **VPS (Coolify)**        | Discord Gateway WebSocket + channel webhooks need persistent processes          |

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

Required env vars (set via `vercel env add` or dashboard): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AGENT_SERVER_URL`, `NEXT_PUBLIC_SLACK_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_APPLICATION_ID`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`

## Security

### Input Validation & Sanitization

- **Zod schemas** on every route — type-safe validation with descriptive error messages
- **JSON parse protection** — malformed request bodies return 400, never crash the server
- **Length limits** — message content (50KB max), voice text (10KB max), file uploads (25MB max)
- **Parameter validation** — all URL params checked for existence and format
- **SQL injection prevention** — supabase-js uses parameterized queries (no raw SQL)

### Output Sanitization

- **PII redaction** — output processor strips emails, API keys, Bearer tokens, phone numbers, credit card numbers, and SSNs before responses leave the system

### Authentication & Encryption

- **Supabase JWT verification** — `supabase.auth.getUser(token)` validates session tokens on every API call
- **Token encryption** — Zapier OAuth tokens encrypted at rest with AES-256-GCM
- **API key hashing** — keys are SHA-256 hashed, never stored in plaintext
- **Webhook signatures** — Slack, Discord, Linear, and other webhooks verify request signatures
- **requireApproval** — 10 write/delete MCP tools require human approval before execution
- **Guardrails** — rate limiting, sensitive app blocking, bulk operation confirmation

## Development

### Testing

Foreman has four tiers of testing. The first two run without any external services.

#### Tier 1 — Unit + API Integration (always works, no external deps)

```bash
cd packages/agents && npm test
```

Runs unit tests (`tests/unit/`) and API integration tests (`tests/integration/api-routes.test.ts`). DB is mocked via supabase-js mock pattern; LLM is served by [AIMock](https://aimock.copilotkit.dev) (`@copilotkit/aimock`) — no real Claude calls. `protocols.test.ts` is included but auto-skips when no dev server is running (~221 tests, 8 auto-skipped).

| Test File                      | What It Tests                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `capabilities.test.ts`         | Feature flags CRUD, default-on behavior                                         |
| `context-injector.test.ts`     | Input processor: connected apps context injection                               |
| `cross-channel-memory.test.ts` | Cross-channel memory recall (same user, different platforms)                    |
| `crypto.test.ts`               | AES-256-GCM token encryption/decryption                                         |
| `env.test.ts`                  | Environment variable validation                                                 |
| `guardrails.test.ts`           | Rate limiting, risk assessment, sensitive app blocking, bulk confirmation       |
| `guardrails-config.test.ts`    | Org-level guardrail defaults and configuration                                  |
| `identity.test.ts`             | Supabase JWT validation, orgId extraction, API key resolution, channel identity |
| `mastra-agent.test.ts`         | Agent initialization, tool registration, model routing                          |
| `model-routing.test.ts`        | Model selection (sonnet/haiku/opus per agent role)                              |
| `pii-redactor.test.ts`         | Output processor: email, API key, phone, card, SSN redaction                    |
| `prompt-template.test.ts`      | Dynamic system prompt generation                                                |
| `stream-types.test.ts`         | SSE stream encoding and type safety                                             |
| `telegram-bot.test.ts`         | Telegram bot initialization and handler wiring                                  |
| `voice.test.ts`                | STT/TTS functions, ElevenLabs primary, OpenAI fallback                          |
| `zapier-errors.test.ts`        | Zapier SDK error classification and retry logic                                 |
| `zapier-sdk-tools.test.ts`     | SDK tool generation, toModelOutput summarizers, requireApproval mapping         |
| `api-routes.test.ts`           | All API endpoints, auth gating, JWT expiry/malformed token rejection            |

#### Tier 2 — Live Supabase (requires `npx supabase start`)

```bash
npx supabase start
cd packages/agents && npm run test:live
```

Real DB connectivity, CRUD round-trips, and identity resolution against a live local Supabase instance. Auto-skips all tests if Supabase is not reachable — safe to run anytime.

#### Tier 3 — Protocol Tests (requires dev server)

```bash
# Terminal 1
cd packages/agents && npm run dev

# Terminal 2
cd packages/agents && npm test
```

`tests/integration/protocols.test.ts` auto-detects the dev server via `/.well-known/foreman/agent-card.json` and runs A2A (JSON-RPC), MCP, and agent-card discovery tests. Skips automatically in CI.

#### Tier 4 — Zapier SDK (requires real Zapier account)

```bash
npx @zapier/zapier-sdk-cli login             # one-time setup
cd packages/agents && npm run test:sdk:read  # safe, no side effects
cd packages/agents && npm run test:sdk:write # creates + deletes a real Zapier Table
```

#### E2E Tests (Playwright)

Located in `packages/web/tests/e2e/`:

```bash
cd packages/web && npx playwright test
```

#### AIMock (Deterministic AI Testing)

Foreman uses [`@copilotkit/aimock`](https://aimock.copilotkit.dev) for mock infrastructure — LLM, voice, MCP, A2A, and vector DB mocking with fixture-driven responses. Tier 1 tests start AIMock automatically via `globalSetup`.

```bash
# Start agent server with AIMock (all APIs mocked)
cd packages/agents && npm run dev:mock
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

| Layer              | Technology                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent framework    | [Mastra](https://mastra.ai) (`@mastra/core`, `@mastra/memory`, `@mastra/mcp`, `@mastra/evals`)                                                             |
| Chat channels      | [Chat SDK](https://chat-sdk.dev) (`chat`, `@chat-adapter/*`)                                                                                               |
| Zapier integration | `@zapier/zapier-sdk` (direct import, 34 auto-generated tools)                                                                                              |
| LLM                | Claude (Anthropic) via Mastra                                                                                                                              |
| Embeddings         | OpenAI (`text-embedding-3-small`)                                                                                                                          |
| Voice STT          | OpenAI Whisper via `@mastra/voice-openai`                                                                                                                  |
| Database           | Postgres + [pgvector](https://github.com/pgvector/pgvector) (local via [Supabase CLI](https://supabase.com/docs/guides/cli); hosted via Supabase/Neon/RDS) |
| DB client          | [supabase-js](https://supabase.com/docs/reference/javascript) (app tables) + `@mastra/pg` (`PostgresStore`, `PgVector` for Mastra internals)               |
| Auth               | [Supabase Auth](https://supabase.com/docs/guides/auth) + `@supabase/ssr` (web frontend and agent server)                                                   |
| Frontend           | [Next.js](https://nextjs.org) 16, React 19, Tailwind 4                                                                                                     |
| Markdown rendering | [Streamdown](https://github.com/nichochar/streamdown) (code, math, mermaid plugins)                                                                        |
| API layer          | [Hono](https://hono.dev) (via Mastra server)                                                                                                               |
| Linting            | [Biome](https://biomejs.dev)                                                                                                                               |
| Testing            | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), [AIMock](https://aimock.copilotkit.dev)                                                |
| Monorepo           | npm workspaces                                                                                                                                             |

## License

MIT License. Copyright (c) 2026 Otaku Solutions.
