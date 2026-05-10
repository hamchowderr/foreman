# Foreman

> AI assistant that takes actions across 9,000+ apps via Zapier.
>
> **Alpha** — active development. Self-hostable today, hosted version coming soon.
> Questions: **tylan@otakusolutions.io**

## Table of Contents

- [What it is](#what-it-is)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Stack](#stack)
- [Modes](#modes)
- [Channels](#channels)
- [Deployment](#deployment)
- [Testing](#testing)
- [Links](#links)

## What it is

Tell Foreman what you want done in plain language — "send Sarah an email", "create a Trello card for tomorrow", "search my Gmail for invoices" — and it figures out which connected app and action to use, shows you what it plans to do for approval, then executes.

Foreman lives on the web, in Slack, Discord, Telegram, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, and iMessage. Same agent, same memory, same connected apps across every channel.

## Requirements

Install before the quick start below:

- **Node.js 22+** — agents and web both run on Node 22 (`node --version`).
- **npm 10+** — bundled with Node 22.
- **Docker Desktop** (or any Docker daemon) — `npx supabase start` boots local Postgres + pgvector inside Docker.
- **git** — for cloning and the `bd dolt` issue-tracker sync.
- **ngrok** *(optional)* — only if you're testing incoming channel webhooks (Slack, Discord, Telegram, Linear) against the real platforms.
- **Zapier CLI account** *(optional, for SDK tests)* — `npx @zapier/zapier-sdk-cli login` once.

## Quick start

Five commands from a clean checkout to a working local dev environment.

```bash
# 1. Install all workspace deps
npm install

# 2. Generate an encryption key. Copy it into packages/agents/.env.local as ENCRYPTION_KEY.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Boot local Supabase (Postgres + pgvector on shifted ports). Copy service_role + anon keys into packages/agents/.env.local.
npx supabase start

# 4. Build and start the agents server (port 4111). Use `npm run start`, not `npm run dev` — `mastra dev` hangs on Windows.
cd packages/agents && npm run build && npm run start

# 5. In a second terminal, start the web frontend (port 3000)
cd packages/web && npm run dev
```

For the full env-var list see [`CLAUDE.md`](CLAUDE.md). For incoming channel webhooks (Slack, Discord, Telegram, Linear), also run `cd packages/agents && npm run start:webhooks` on port 4112.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      User entry points                     │
│  Web ·  Slack · Discord · Telegram · Teams · WhatsApp ·    │
│  iMessage · GitHub · Linear · Google Chat · MCP · A2A      │
└────────────┬────────────────────────────┬──────────────────┘
             │                            │
             ▼                            ▼
   packages/web (Next.js :3000)   packages/agents (:4111 + :4112)
        Supabase auth, SSE              Mastra + Hono
        chat UI, /workflows             5 agents (Foreman, Discovery,
        page, voice mic                 Execution, History, Supervisor)
                                        ┌─────────────────┐
                                        │   Supabase PG   │ users, conversations,
                                        │   + pgvector    │ proposals, runs, workflows,
                                        └────────┬────────┘ Mastra threads + memory
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │  Zapier SDK     │ direct import of
                                        │  (single-shot)  │ @zapier/zapier-sdk → 34 tools
                                        └─────────────────┘
```

- **Agents server (`:4111`):** Mastra agents over Hono. Custom routes at `/chat`, `/conversations`, `/proposals`, `/workflows`, `/capabilities`, `/voice`, plus built-in `/api/agents`, `/a2a/foreman`, `/mcp/*`.
- **Webhooks server (`:4112`):** separate process for Discord Gateway WebSocket and channel webhooks. Some channels (Discord) need both servers running.
- **Web frontend (`:3000`):** Next.js 16 + React 19 + Tailwind 4 + shadcn/ui. Talks to the agents server over SSE for streaming.
- **Storage:** `MastraCompositeStore` on Postgres (default domains) + DuckDB (observability domain — traces, scores, metrics).
- **Channels:** Chat SDK adapters (`@chat-adapter/*`). Each platform user is mapped to a Foreman user via the `channel_identity` table.

## Stack

| Layer | Technology |
|---|---|
| Agent framework | [Mastra](https://mastra.ai) — `@mastra/core`, `@mastra/memory`, `@mastra/evals`, `@mastra/duckdb`, `@mastra/observability` |
| Chat channels | [Chat SDK](https://chat-sdk.dev) — `chat`, `@chat-adapter/*` |
| Action layer | `@zapier/zapier-sdk` (direct import; 34 auto-generated tools) |
| LLM | Claude (Anthropic) — Sonnet 4.6 default, Haiku 4.5 for fast steps |
| Embeddings / STT | OpenAI `text-embedding-3-small`, Whisper via `@mastra/voice-openai` |
| API server | [Hono](https://hono.dev) (mounted via Mastra) |
| Database | Postgres + [pgvector](https://github.com/pgvector/pgvector); local via [Supabase CLI](https://supabase.com/docs/guides/cli), hosted via Supabase / Neon / RDS |
| DB clients | `supabase-js` (app tables), `@mastra/pg` (Mastra internals) |
| Auth | [Supabase Auth](https://supabase.com/docs/guides/auth) + `@supabase/ssr` |
| Frontend | [Next.js](https://nextjs.org) 16, React 19, Tailwind 4, [shadcn/ui](https://ui.shadcn.com) |
| Markdown | [Streamdown](https://github.com/nichochar/streamdown) |
| Testing | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), [AIMock](https://aimock.copilotkit.dev) |
| Linting | [Biome](https://biomejs.dev) |
| Monorepo | npm workspaces |

## Modes

`FOREMAN_MODE` in `packages/agents/.env.local` decides how Zapier auth resolves. There are really two modes from your perspective: **dev** (you, on your laptop) and **self-hosted** (you, running it for other users).

| Mode | Value | When to use | Auth model |
|---|---|---|---|
| **Dev** | `dev` (default) | Local development on a single machine | Single Zapier CLI login (`npx @zapier/zapier-sdk-cli login`). No client credentials needed. |
| **Self-hosted** | `self_hosted` | Running Foreman for real users on your own infra (VPS, cluster, etc.) | Each user OAuths their own Zapier account through the Foreman UI. Requires `ZAPIER_CLIENT_ID` + `ZAPIER_CLIENT_SECRET`. |

> The code also accepts `production` as a synonym for `self_hosted` — that's the value we tag our own hosted deploy at https://foreman.otakusolutions.io with. From a code-path standpoint they are identical. As a self-hoster you should use `self_hosted`.

Self-hosted is **not** a single-shared-account mode. Each user still connects their own Zapier account — Foreman just runs on infrastructure you own instead of ours.

## Channels

| Channel | Adapter | Status |
|---|---|---|
| Web | Next.js frontend | Working |
| Slack | `@chat-adapter/slack` | Working |
| Telegram | `@chat-adapter/telegram` | Working |
| Discord | `@chat-adapter/discord` | Working (needs both `:4111` and `:4112` running) |
| Google Chat | `@chat-adapter/gchat` | Working |
| GitHub | `@chat-adapter/github` | Working |
| Linear | `@chat-adapter/linear` | Working |
| Microsoft Teams | `@chat-adapter/teams` | In progress — pending M365 license |
| WhatsApp | `@chat-adapter/whatsapp` | In progress |
| iMessage | `chat-adapter-imessage` | In progress (requires macOS host) |
| MCP | Mastra built-in | `GET /mcp/*` — Claude Code, ChatGPT, etc. |
| A2A | Mastra built-in | `POST /a2a/foreman` — agent-to-agent |

Per-channel webhook URLs and platform setup live in [`CLAUDE.md`](CLAUDE.md).

## Deployment

| Component | Target | Notes |
|---|---|---|
| Web | **Vercel** | Standard Next.js project. Configured via `vercel.json`. |
| Agents server | **Coolify on Hostinger VPS** | Long-lived process under PM2, fronted by nginx + Certbot SSL. Streaming SSE and Discord Gateway need persistent connections. |
| Agents server (alt) | **Vercel** | Viable with hosted Postgres. Build with `npm run build:vercel`. |
| Webhooks server | **Coolify on Hostinger VPS** | Same VPS as agents; separate PM2 process on `:4112`. |

Live URLs:

- Web: https://foreman.otakusolutions.io
- Agents: https://foreman-agents.otakusolutions.io

## Testing

Four tiers, plus end-to-end browser tests. Tier 1 is the default loop and runs without any external services.

| Tier | Command | What it covers | Requires |
|---|---|---|---|
| Unit + API integration | `cd packages/agents && npm test` | Unit tests + mocked API routes via [AIMock](https://aimock.copilotkit.dev) | nothing |
| Live Supabase | `cd packages/agents && npm run test:live` | Real DB CRUD round-trips and identity resolution; auto-skips if Supabase isn't running | `npx supabase start` |
| Zapier SDK | `cd packages/agents && npm run test:sdk:read` / `test:sdk:write` | Live calls to your Zapier account; `:write` creates and deletes a real Zapier Table | `npx @zapier/zapier-sdk-cli login` |
| Protocol | `cd packages/agents && npm test` (tier 1) with the dev server up | Auto-detects dev server and runs A2A + MCP + agent-card discovery | agents server running |
| E2E (browser) | `cd packages/web && npx playwright test` | Web flows | web + agents servers running |

For deterministic mock-mode dev (no real LLM/voice/MCP/A2A): `cd packages/agents && npm run dev:mock`.

Deeper developer docs (file inventory, route table, custom tools, processors, memory config, schema, prompt internals) live in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md). The README is for orientation; CLAUDE.md is for working in the code.

## Links

- [Mastra docs](https://mastra.ai/docs)
- [Chat SDK docs](https://chat-sdk.dev)
- [Zapier SDK docs](https://docs.zapier.com/sdk)
- [Supabase docs](https://supabase.com/docs)
- [shadcn/ui docs](https://ui.shadcn.com/docs)
- Internal: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md)

## License

MIT. Copyright (c) 2026 Otaku Solutions.
