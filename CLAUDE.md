@AGENTS.md

## Monorepo Layout

```
packages/agents/   → Mastra + Hono agent server (port 4111)
packages/web/      → Next.js 16 frontend (port 3000)
```

## Where to Find Things

### Agents

| Agent             | File                                     | Model      | Tools                                                   |
| ----------------- | ---------------------------------------- | ---------- | ------------------------------------------------------- |
| Foreman (primary) | `agents/src/mastra/agents/foreman.ts`    | sonnet 4.6 | All SDK tools (via ToolSearchProcessor), 3 custom tools |
| Supervisor        | `agents/src/mastra/agents/supervisor.ts` | sonnet 4.6 | Routes to discovery/execution/history agents            |
| Discovery         | `agents/src/mastra/agents/discovery.ts`  | haiku 4.5  | 9 read-only SDK tools                                   |
| Execution         | `agents/src/mastra/agents/execution.ts`  | sonnet 4.6 | run-action, fetch, request, connect_zapier              |
| History           | `agents/src/mastra/agents/history.ts`    | haiku 4.5  | search_history                                          |

Mastra instance + server config: `agents/src/mastra/index.ts`

### Zapier SDK Tools

- **Generator**: `agents/src/lib/zapier-sdk-tools.ts` — direct `@zapier/zapier-sdk` import, no MCP/stdio
- SDK method names are camelCase internally, converted to kebab-case for tool IDs
- Parameter names come from the SDK's Zod schemas — read them from the registry, never guess
  - Table operations use `table` (not `tableId`)
  - Record creation uses `{ data: {...} }` wrapper per record
- `APPROVAL_REQUIRED` set: 9 write/delete tools need human approval
- `READ_ONLY` set: 17 discovery tools
- `DEPRECATED_METHODS` set: 5 excluded (request, listAuthentications, etc.)
- `zapier-mcp.ts` — old MCP stdio approach, deprecated but still in tree

### Custom Tools

| Tool              | File                                           |
| ----------------- | ---------------------------------------------- |
| connect_zapier    | `agents/src/mastra/tools/connect-zapier.ts`    |
| search_history    | `agents/src/mastra/tools/search-history.ts`    |
| fork_conversation | `agents/src/mastra/tools/fork-conversation.ts` |

### API Routes

All custom routes: `agents/src/routes/index.ts` (Hono, mounted as Mastra middleware)

| Route               | File                       | Purpose                       |
| ------------------- | -------------------------- | ----------------------------- |
| `/conversations/*`  | `routes/conversations.ts`  | CRUD + SSE message streaming  |
| `/proposals/*`      | `routes/proposals.ts`      | Approve/decline/field-choices |
| `/workflows/*`      | `routes/workflows.ts`      | Workflow CRUD + SSE run       |
| `/zapier/*`         | `routes/zapier-connect.ts` | OAuth callback flow           |
| `/capabilities`     | `routes/capabilities.ts`   | Per-user feature flags        |
| `/guardrails`       | `routes/guardrails.ts`     | Safety settings               |
| `/voice`            | `routes/voice.ts`          | STT/TTS endpoints             |
| `/telegram/webhook` | `telegram/webhook.ts`      | Telegram bot                  |
| `/slack/webhook`    | `slack/webhook.ts`         | Slack bot                     |
| `/discord/webhook`  | `discord/webhook.ts`       | Discord bot                   |

Mastra built-in routes (not ours): `/api/agents`, `/a2a/foreman`, `/mcp/*`

### Auth

- **Middleware**: `agents/src/routes/middleware.ts` — Supabase JWT validation via `getSupabase().auth.getUser(token)`
- **Identity resolution**: `agents/src/lib/identity.ts` — maps channel users to Foreman users; validates web JWTs via `resolveFromSupabaseJwt`
- **API auth**: `agents/src/lib/api-auth.ts` — JWT + API key (`fmn_` prefix)
- **Web auth**: `@supabase/ssr` — `lib/server.ts` (server components), `lib/client.ts` (browser), `lib/middleware.ts` (session refresh)
- **Auth pages**: `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`

### Database

- **Schema**: `agents/src/lib/db/schema.ts` — plain TypeScript interfaces (snake_case, mirrors DB columns)
- **Client**: `agents/src/lib/db/index.ts` — `getSupabase()` returns supabase-js service_role client
- **Mastra storage**: `PostgresStore` from `@mastra/pg` (direct `DATABASE_URL` connection, separate from supabase-js)
- **Vector**: `PgVector` from `@mastra/pg`
- **Migrations**: `supabase/migrations/` — applied automatically by `npx supabase db reset`
- **Local dev**: Supabase CLI — `npx supabase start` (ports shifted +100 to avoid collisions)
  - API: http://127.0.0.1:54421
  - Postgres: 127.0.0.1:54422 (user: `postgres`, pass: `postgres`, db: `postgres`)
  - Studio: http://127.0.0.1:54423
  - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54422/postgres`
  - `supabase/config.toml` disables unused services (storage, auth, realtime, inbucket, analytics, edge_runtime) — they fail health checks on Windows and Foreman doesn't use them
- Tables: user, zapier_identity, conversation, action_proposal, action_run, workflow, workflow_step, workflow_run, capability_flag, channel_identity, api_key

### Key Lib Files

| File                     | What                                             |
| ------------------------ | ------------------------------------------------ |
| `lib/crypto.ts`          | AES-256-GCM token encryption                     |
| `lib/env.ts`             | Environment variable validation                  |
| `lib/processors/`        | Input (context injector) + Output (PII redactor) |
| `lib/prompt-template.ts` | Dynamic system prompt builder                    |
| `lib/proposals.ts`       | Action proposal DB access                        |
| `lib/stream/`            | SSE encoding, chunk transformer                  |
| `lib/rag/`               | Action history indexing + semantic search        |
| `lib/validation.ts`      | Shared Zod schemas                               |
| `lib/voice.ts`           | STT (Whisper) + TTS (ElevenLabs/OpenAI)          |
| `lib/guardrails.ts`      | Rate limiting, risk assessment                   |
| `lib/workflows/`         | Daily summary, health check workflows            |

### Frontend

| What           | Where                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| App layout     | `web/src/app/layout.tsx`                                                 |
| Chat UI        | `web/src/components/chat-shell.tsx`, `chat-pane.tsx`, `chat-message.tsx` |
| Approval cards | `web/src/components/approval-card.tsx`                                   |
| API client     | `web/src/lib/api-client.ts` — all agent server calls                     |
| Workflows page | `web/src/app/workflows/`                                                 |

## Getting Started

First-time setup requires a running local Supabase instance before `npm run dev`:

```bash
npx supabase start                         # Boots local Postgres/pgvector on :54422; applies supabase/migrations/*.sql automatically
```

## ngrok (optional — only for channel webhooks)

ngrok is only needed if you're testing **incoming channel webhooks** (Slack, Discord, Telegram, Linear) that require a public URL. The Zapier OAuth callback uses `ZAPIER_REDIRECT_URI=http://localhost:4111/zapier/callback` (set in `.env.local`) — no ngrok required.

If you do need ngrok (e.g., for channel webhooks):

```bash
ngrok http 4111                            # Get a new public URL
```

Then update `packages/agents/.env.local` → `AGENT_SERVER_URL=https://<new-url>.ngrok-free.app`

Restart the agents server so it picks up the new URL:

```bash
cd packages/agents && npm run build && npm run start   # Windows: mastra dev hangs (IPC). Linux/Mac: npm run dev. Local quirk only — do not put in public docs.
```

## Dev Commands

```bash
# Prereq: local DB
npx supabase start                         # Supabase (Postgres :54422, Studio :54423)
npx supabase stop                          # Shut it down

# Dev servers
cd packages/agents && npm run build && npm run start   # Agents (:4111). Windows workaround for mastra dev IPC hang — Linux/Mac use `npm run dev`.
cd packages/web && npm run dev                          # Next.js (:3000)
cd packages/agents && npm run start:webhooks            # Channel webhooks (:4112)

# Build
cd packages/agents && npm run build        # mastra build → .mastra/output/
cd packages/agents && npm run build:vercel  # for Vercel deployment

# Database
npx supabase db reset                      # apply migrations from supabase/migrations/

# Lint
npm run lint && npm run format
```

## Testing

```bash
# Unit (mocked, fast)
cd packages/agents && npm test

# SDK integration (real Zapier API — needs `npx @zapier/zapier-sdk-cli login`)
cd packages/agents && npm run test:sdk          # all
cd packages/agents && npm run test:sdk:read     # read-only
cd packages/agents && npm run test:sdk:write    # creates + deletes a real Zapier Table

# Integration (API routes, protocols)
cd packages/agents && npm test -- tests/integration

# E2E (browser)
cd packages/web && npx playwright test

# Mock mode (no real LLM/API)
cd packages/agents && npm run dev:mock
```

SDK tests use `vitest.sdk.config.ts` (no aimock). Unit/integration tests use `vitest.config.ts` (with aimock globalSetup).

## Deploy

| Component | Target        | Config                                                |
| --------- | ------------- | ----------------------------------------------------- |
| Web       | Vercel        | `vercel.json`                                         |
| Agents    | VPS (Coolify) | `Dockerfile.agents`, UUID: `oqshe32xh3v8zva7tt6r4aff` |
| Agents    | Vercel (alt)  | `npm run build:vercel` + Turso for LibSQL             |

## Env Vars

**agents/.env.local:** `DATABASE_URL`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOREMAN_MODE` (dev/production/self_hosted), `ZAPIER_CLIENT_ID`, `ZAPIER_CLIENT_SECRET`

**web/.env.local:** `NEXT_PUBLIC_AGENT_SERVER_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Channel tokens (optional): `TELEGRAM_BOT_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
