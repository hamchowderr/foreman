<div align="center">

# 👷 Foreman

### Describe the task. It gets done — across 10,000+ apps, from any chat.

**Foreman is an AI assistant that takes real actions across 10,000+ apps through [Zapier](https://zapier.com/).** Tell it what you want in plain language — _"send Sarah the Q3 deck"_, _"create a Trello card for tomorrow"_, _"search my Gmail for unpaid invoices"_ — and it figures out which connected app and action to use, shows you exactly what it plans to do for approval, then executes. Same agent, same memory, same connected apps whether you're on the web, in Slack, Discord, Telegram, Teams, and more.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#-license)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange)]()
[![Node: 22+](https://img.shields.io/badge/node-22%2B-339933?logo=node.js&logoColor=white)](#-getting-started)
[![Built on Mastra](https://img.shields.io/badge/built%20on-Mastra-000)](https://mastra.ai)
[![Powered by Zapier SDK](https://img.shields.io/badge/powered%20by-Zapier%20SDK-FF4A00?logo=zapier&logoColor=white)](https://docs.zapier.com/sdk)
[![Website](https://img.shields.io/badge/website-foreman.otakusolutions.io-111)](https://foreman.otakusolutions.io)

</div>

![Foreman Screenshot](docs/screenshot.png)

> _Screenshot placeholder — to be added._

---

> **Open source — and a template.** Foreman was built to contribute to Zapier's open-source SDK ecosystem, and to be a working template for anyone who wants to explore, learn, and build with the Zapier SDK — solo, with a team, or with clients.

## ⚡ What it does

Tell Foreman what you want, in plain English:

> _"Email Sarah the Q3 deck, then log it in Notion."_ · _"Create a Trello card for tomorrow's standup."_ · _"Search my Gmail for unpaid invoices this month."_

Foreman figures out **which connected app and action** fits — out of [10,000+ on Zapier](https://zapier.com/apps) — drafts exactly what it's about to do, and **shows it to you as an approval card first**. You approve, edit, or decline. Only then does it run for real. Nothing happens without your approval.

Then just keep talking:

> _"Actually CC the whole team."_ · _"Do the same for the August numbers."_ · _"Schedule it for 9am instead."_

It's the **same agent across every surface** — the web app, Slack, Discord, Telegram, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, and iMessage — with one shared memory and one set of connected accounts. Start a task in Slack, finish it on the web.

Foreman runs on Mastra's **Agent Harness** — one agent that spawns focused sub-agents (discovery, execution, history) as needed and loads only the Zapier tools a request needs, so it calls real APIs, with approval and per-user auth built in.

---

## 💬 What a request looks like

One message → a proposed action you can see and approve → a real result in the connected app.

<details>
<summary><b>"Email Sarah the Q3 deck and log it in Notion"</b> — click to expand</summary>

**You:**

> Email Sarah the Q3 deck and log it in Notion.

**Foreman** finds the matching Zapier actions and proposes the first one as an **approval card** — no execution yet:

```
┌─ Action proposal ─────────────────────────────┐
│  Gmail · Send Email                           │
│  to:       sarah@acme.com                     │
│  subject:  Q3 deck                            │
│  body:     Hi Sarah — Q3 deck attached …      │
│  attach:   Q3-deck.pdf                        │
│                                               │
│   [ ✅ Approve ]  [ ✏️ Edit ]  [ ❌ Decline ] │
└───────────────────────────────────────────────┘
```

**You** approve → Foreman runs it via the Zapier SDK, then proposes the **Notion** step:

```
✓ Gmail · Send Email — sent (run #4131)

┌─ Action proposal ─────────────────────────────┐
│  Notion · Create Database Item               │
│  database:  Sent Reports                      │
│  title:     Q3 deck → Sarah                   │
│  date:      2026-06-11                         │
│   [ ✅ Approve ]  [ ✏️ Edit ]  [ ❌ Decline ] │
└───────────────────────────────────────────────┘
```

Every run is recorded (who, what, when, result) and searchable later — _"what did I send Sarah last quarter?"_

</details>

> Illustrative — the real apps, fields, and steps vary with your prompt and which accounts you've connected. Write actions always surface as an approval card before they run.

---

## 🎯 Why Foreman?

- **🌐 One agent, every channel.** Web, Slack, Discord, Telegram, Microsoft Teams, Google Chat, WhatsApp, GitHub, Linear, iMessage — plus MCP and A2A for other agents. Same memory and connected apps everywhere.
- **✋ Approval-gated by default.** Write and delete actions always ask first — Foreman shows a proposal card and waits for **approve / edit / decline**. Read-only discovery runs freely.
- **🔌 10,000+ apps, real APIs.** Actions come straight from [`@zapier/zapier-sdk`](https://docs.zapier.com/sdk) as auto-generated tools — no hand-wired integrations, no made-up API calls. Parameter names come from Zapier's own schemas.
- **🧠 Memory that follows you.** Conversations, action history, and embeddings live in Postgres + pgvector (local `fastembed` embeddings — no embedding API needed), so Foreman remembers context and you can semantically search past runs.
- **📚 Documents.** Save notes, plans, and specs to a shared team workspace and **semantically search them in chat**.
- **🔁 Automations.** Build durable, scheduled automations with an at-a-glance daily digest _(experimental — needs Zapier early-access; see [Experimental access](#-experimental-access))_.
- **🔐 Per-user auth.** Each person connects **their own** Zapier account through an OAuth (PKCE) flow — Foreman never shares one account across users.
- **🏠 Self-hostable today.** Run the whole stack on your own infra. Hosted version coming soon.
- **🤖 Model choice.** Claude Sonnet 4.6 for reasoning, Haiku 4.5 for fast steps — swappable via the provider layer.
- **🎙️ Voice in.** Speak a request and it's transcribed into the chat (Whisper).

---

## 🧠 How it works

```
        "Email Sarah the Q3 deck and log it in Notion"
                            │
                            ▼
            ┌──────────────────────────────────┐
            │          Foreman agent           │   Claude Sonnet 4.6
            │   Mastra + ToolSearch over 26    │
            │     live Zapier SDK tools        │
            └────────────────┬─────────────────┘
                             │ picks app + action, fills params
                             ▼
            ┌──────────────────────────────────┐
            │         Action proposal          │   shown to you as
            │    "Gmail · Send Email to …"     │   an approval card
            └────────────────┬─────────────────┘
                  approve?    │   ✅ / ✏️ edit / ❌
                             ▼
            ┌──────────────────────────────────┐
            │     Zapier SDK · runAction       │   executes for real
            └────────────────┬─────────────────┘
                             ▼
              result + run history (Postgres + pgvector)
```

A request lands from any channel, hits the **Foreman agent**, which loads only the Zapier tools that request needs (via a tool-search step, instead of loading all 26 at once). Write actions become **proposals**; you approve them; the **Zapier SDK** runs them; the result and full run record persist to Postgres. The harness spawns focused, tool-isolated sub-agents (discovery, execution, history) on demand, so each step stays cheap and reliable.

---

## 🔐 Proposals & approval

Foreman separates **reading** from **making changes**:

- ✅ **Read-only discovery** (list channels, search records, fetch a row) runs immediately — it's harmless.
- ⏸️ **Writes and deletes pause for approval.** A proposal card shows the exact app, action, and every field before anything runs. You approve, edit the fields, or decline.
- 🧾 **Every run is recorded** — app, action, inputs, result, who triggered it, when — and is semantically searchable afterward.
- 🛡️ **Guardrails** apply rate limits and risk assessment; an output processor redacts PII before responses leave the agent.

The set of write/delete tools that require approval is explicit (9 of them), separate from the 17 read-only discovery tools — so the boundary is defined in code.

---

## 🔌 Channels

| Channel | Adapter | Status |
|---|---|---|
| Web | Next.js frontend | ✅ Working |
| Slack | `@chat-adapter/slack` | ✅ Working |
| Telegram | `@chat-adapter/telegram` | ✅ Working |
| Discord | `@chat-adapter/discord` | ✅ Working |
| Google Chat | `@chat-adapter/gchat` | ✅ Working |
| GitHub | `@chat-adapter/github` | ✅ Working |
| Linear | `@chat-adapter/linear` | ✅ Working |
| Microsoft Teams | `@chat-adapter/teams` | 🚧 In progress — pending M365 license |
| WhatsApp | `@chat-adapter/whatsapp` | 🚧 In progress |
| iMessage | `chat-adapter-imessage` | 🚧 In progress _(requires macOS host)_ |
| MCP | Mastra built-in | `GET /mcp/*` — Claude Code, ChatGPT, etc. |
| A2A | Mastra built-in | `POST /a2a/foreman` — agent-to-agent |

Each platform user is mapped to a Foreman user via the `channel_identity` table. Per-channel webhook URLs and platform setup live in [`CLAUDE.md`](CLAUDE.md).

---

## 🧪 Experimental access

Foreman's action layer runs on [`@zapier/zapier-sdk`](https://docs.zapier.com/sdk), which is currently in Zapier's **early-access / open-beta** program — and the **durable & scheduled automations** feature uses the SDK's _experimental_ surface, gated behind a Zapier **early-access allowlist**.

**What that means right now:**

- ✅ The **everyday action layer** — run actions, discovery, tables, trigger inboxes — plus chat, approvals, documents, and memory all work with a normal Zapier login.
- ⏳ **Durable + scheduled automations** (the `/automations` page and daily digest) need your Zapier account on the experimental allowlist, so you must **apply for access first**.

👉 **Apply for experimental access here: [next-gen-zaps.zapier.app →](https://next-gen-zaps.zapier.app/)**

---

## 🚀 Getting started

**Prerequisites:**

- **Node.js 22+** — agents and web both run on Node 22 (`node --version`).
- **npm 10+** — bundled with Node 22.
- **Docker Desktop** (or any Docker daemon) — `npx supabase start` boots local Postgres + pgvector inside Docker.
- **git** — for cloning and the `bd dolt` issue-tracker sync.
- **ngrok** _(optional)_ — only for testing incoming channel webhooks (Slack, Discord, Telegram, Linear) against the real platforms.
- **Zapier CLI account** _(optional, for SDK tests)_ — `npx @zapier/zapier-sdk-cli login` once.

Five commands from a clean checkout to a working local dev environment:

```bash
# 1. Install all workspace deps
npm install

# 2. Generate an encryption key → copy into packages/agents/.env.local as ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Boot local Supabase (Postgres + pgvector, shifted ports)
#    → copy the service_role + anon keys into packages/agents/.env.local
npx supabase start

# 4. Start the agents server + Mastra Studio (:4111). `npm run dev` gives hot reload;
#    use `npm run build && npm run start` for a production-style run.
cd packages/agents && npm run dev

# 5. In a second terminal, start the web frontend (:3000)
cd packages/web && npm run dev
```

Copy `packages/agents/.env.example` → `.env.local` (and `packages/web/.env.example` for the frontend) — every variable is documented inline. For incoming channel webhooks, also run `cd packages/agents && npm run start:webhooks` on port `:4112`. For deterministic mock-mode dev (no real LLM / voice / MCP / A2A): `cd packages/agents && npm run dev:mock`.

---

## 🏠 Run it your way

Same agent, same connected apps — you just choose how Zapier auth resolves. `FOREMAN_MODE` (in `packages/agents/.env.local`) picks the mode:

| | 🧑‍💻 **Dev** | 🌐 **Self-hosted** |
|---|---|---|
| **Value** | `dev` (default) | `self_hosted` |
| **When** | Local dev on a single machine | Running Foreman for real users on your own infra |
| **Auth** | One Zapier CLI login (`npx @zapier/zapier-sdk-cli login`) | Each user OAuths their own Zapier account through the UI |
| **Needs** | Nothing extra | `ZAPIER_CLIENT_ID` + `ZAPIER_CLIENT_SECRET` |

Self-hosted is **not** a single-shared-account mode — every user still connects their own Zapier account. Foreman just runs on infrastructure **you** own instead of ours. A managed hosted version is coming soon.

> Which credential works on which SDK surface is documented in [`docs/zapier-auth-model.md`](docs/zapier-auth-model.md). New to the SDK? See [Working with the Zapier SDK](#-working-with-the-zapier-sdk) below.

---

## 🔌 Working with the Zapier SDK

Foreman's entire action layer is generated from [`@zapier/zapier-sdk`](https://docs.zapier.com/sdk) — every one of the 10,000+ apps becomes a tool, with parameter names read straight from Zapier's own schemas. If you haven't used the SDK directly, here's the whole picture.

### Two packages

| Package | What it is |
|---|---|
| [`@zapier/zapier-sdk`](https://www.npmjs.com/package/@zapier/zapier-sdk) | The library Foreman imports directly. Its registry is what becomes the 26 live tools — no MCP child process, no hand-wired integrations. |
| [`@zapier/zapier-sdk-cli`](https://www.npmjs.com/package/@zapier/zapier-sdk-cli) | The companion CLI. Used to log in for local dev, and to try the SDK by hand and see what an app/action expects. |

### Logging in — the four ways

Foreman accepts any credential type the SDK does; you pick one with `FOREMAN_MODE` + env vars. What each is, and when to reach for it:

| Method | How | Use it for |
|---|---|---|
| **CLI login** | `npx @zapier/zapier-sdk-cli login` → writes `~/.zapier-sdk/config.json` | The simplest dev path. `FOREMAN_MODE=dev` falls back to it automatically. |
| **Per-user OAuth (PKCE)** | Each user clicks _Connect Zapier_ in the UI | Self-hosted / multi-user — everyone connects _their own_ account. Needs `ZAPIER_CLIENT_ID` + `ZAPIER_CLIENT_SECRET`. |
| **Client credentials** | `ZAPIER_CLIENT_ID` + `ZAPIER_CLIENT_SECRET` | App-level, server-to-server calls. |
| **Token override** | `DEV_ZAPIER_OVERRIDE=<jwt>` | Use a pre-obtained token for local dev — skips login entirely. |

> **Heads-up:** not every surface is open yet. The everyday action layer (run actions, discovery, tables, trigger inboxes) works with any Zapier login. The experimental **durable / scheduled-automation** endpoints are gated behind a Zapier **early-access allowlist**, so automations require applying for access — see [Experimental access](#-experimental-access). More detail: [`docs/zapier-auth-model.md`](docs/zapier-auth-model.md).

### Staying current — `npm run sdk:check`

The Zapier SDK updates often, and new capabilities can arrive in minor releases. To make it easy to see whether you're on the latest, the repo ships a version watcher:

```bash
npm run sdk:check          # full report: installed vs latest, releases behind, changelog delta
npm run sdk:check:quiet    # one-line notice, only when a newer version exists
```

It checks both packages and never fails a build if npm is unreachable. Bump deliberately — minor releases can change behavior.

### Explore the SDK yourself

The repo includes the SDK + CLI docs and a tool to list the live SDK surface yourself:

| Resource | What it gives you |
|---|---|
| [`docs/zapier-sdk/quickstart.md`](docs/zapier-sdk/quickstart.md) · [`using-the-cli.md`](docs/zapier-sdk/using-the-cli.md) | Hands-on: install, log in, run your first action from the CLI. |
| [`docs/zapier-sdk/cli-reference.md`](docs/zapier-sdk/cli-reference.md) · [`sdk-reference.md`](docs/zapier-sdk/sdk-reference.md) | Full command + method reference for the CLI and SDK. |
| [`docs/zapier-sdk-capability-map.md`](docs/zapier-sdk-capability-map.md) | A reference of every SDK surface, what Foreman uses, and what it deliberately doesn't. |
| `npx tsx packages/agents/scripts/sdk-surface-sweep.ts` | Lists the full live SDK surface — no credentials or network needed. |

---

## 🧱 Architecture

A two-package npm-workspaces monorepo: a Mastra + Hono **agents server** and a Next.js **web** frontend, both on Postgres.

```
packages/
├─ agents/                  Mastra + Hono agent server (:4111)
│  ├─ src/mastra/
│  │  ├─ agents/             Foreman on the Mastra Agent Harness — spawns discovery · execution · history
│  │  └─ tools/              connect_zapier · search_history · save_document · preview_app · automations · …
│  ├─ src/lib/
│  │  ├─ zapier-sdk-tools    26 auto-generated tools from @zapier/zapier-sdk
│  │  ├─ zapier/             PKCE OAuth connect flow + per-user SDK
│  │  ├─ db/                 Supabase schema + service-role client
│  │  ├─ processors/         context injector (in) + PII redactor (out)
│  │  └─ rag/                action-history indexing + semantic search
│  ├─ src/routes/            Hono: /conversations /proposals /automations /apps /documents /voice …
│  └─ src/{slack,discord,telegram,teams,…}/   channel webhooks (:4112)
└─ web/                     Next.js 16 frontend (:3000)
   └─ src/
      ├─ app/                App Router — chat, /apps, /automations, /documents, /auth
      ├─ components/         chat/ (shell · messages · message) · ai-elements/tool (inline approvals)
      └─ lib/*-client        conversations · apps · documents · stored-agents → agent server

supabase/migrations/         Postgres schema (users, conversations, proposals,
                             runs, automations, channel_identity, …)
```

```
┌────────────────────────────────────────────────────────────┐
│                      User entry points                     │
│  Web · Slack · Discord · Telegram · Teams · WhatsApp ·     │
│  iMessage · GitHub · Linear · Google Chat · MCP · A2A      │
└────────────┬────────────────────────────┬──────────────────┘
             ▼                            ▼
   packages/web (Next.js :3000)   packages/agents (:4111 + :4112)
     Supabase auth · SSE              Mastra + Hono
     chat UI · /automations           Foreman on the Mastra Harness
     page · voice mic                 (spawns discovery/execution/history)
                                              │
                                              ▼
                                     ┌─────────────────┐  users, conversations,
                                     │   Supabase PG   │  proposals, runs,
                                     │   + pgvector    │  workflows, Mastra memory
                                     └────────┬────────┘
                                              ▼
                                     ┌─────────────────┐  direct import of
                                     │   Zapier SDK    │  @zapier/zapier-sdk
                                     │  (direct call)  │  → 26 tools
                                     └─────────────────┘
```

- **Agents server (`:4111`):** Mastra agents over Hono. Custom routes — `/chat`, `/conversations`, `/proposals`, `/automations`, `/apps`, `/documents`, `/capabilities`, `/voice` — plus Mastra built-ins `/api/agents`, `/a2a/foreman`, `/mcp/*`.
- **Webhooks server (`:4112`):** optional separate process for inbound channel webhooks — HTTP only, no persistent socket.
- **Web frontend (`:3000`):** Next.js 16 + React 19 + Tailwind 4 + shadcn/ui, streaming over SSE.
- **Storage:** `PostgresStore` (a Mastra composite store) on Postgres — every Mastra domain, **including observability** (traces, scores, metrics); no DuckDB.

### Stack

| Layer | Technology |
|---|---|
| Agent framework | [Mastra](https://mastra.ai) — `@mastra/core`, `@mastra/memory`, `@mastra/rag`, `@mastra/evals`, `@mastra/observability`, `@mastra/loggers`, `@mastra/ai-sdk`, `@mastra/editor` (plus `@mastra/pg`, `@mastra/fastembed`, `@mastra/voice-openai` in the rows below; `mastra` CLI + `@mastra/deployer-*` for build/deploy) |
| Chat channels | [Vercel Chat SDK](https://chat-sdk.dev) — `chat`, `@chat-adapter/*` ([github.com/vercel/chat](https://github.com/vercel/chat)) |
| Action layer | `@zapier/zapier-sdk` (direct import; 26 auto-generated tools) |
| LLM | Claude (Anthropic) — Sonnet 4.6 default, Haiku 4.5 for fast steps |
| Embeddings / STT | **fastembed** (local ONNX, `bge-small` 384-d) for vectors · Whisper via `@mastra/voice-openai` for STT |
| API server | [Hono](https://hono.dev) (mounted via Mastra) |
| Database | Postgres + [pgvector](https://github.com/pgvector/pgvector) — local via [Supabase CLI](https://supabase.com/docs/guides/cli), hosted via Supabase / Neon / RDS |
| DB clients | `supabase-js` (app tables), `@mastra/pg` (Mastra internals) |
| Auth | [Supabase Auth](https://supabase.com/docs/guides/auth) + `@supabase/ssr` |
| Frontend | [Next.js](https://nextjs.org) 16, React 19, Tailwind 4, [shadcn/ui](https://ui.shadcn.com) |
| Markdown | [Streamdown](https://github.com/nichochar/streamdown) |
| Testing | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), [AIMock](https://aimock.copilotkit.dev) |
| Linting | [Biome](https://biomejs.dev) |
| Monorepo | npm workspaces |

---

## 🧪 Build & test

Four tiers plus end-to-end browser tests. **Tier 1 is the default and runs without any external services** — real provider keys are intentionally absent, so any accidental real API call fails clearly.

| Tier | Command | What it covers | Requires |
|---|---|---|---|
| **Unit + API integration** | `cd packages/agents && npm test` | Unit tests + mocked API routes via [AIMock](https://aimock.copilotkit.dev) | nothing |
| **Live Supabase** | `cd packages/agents && npm run test:live` | Real DB CRUD round-trips + identity resolution; auto-skips if Supabase is down | `npx supabase start` |
| **Zapier SDK** | `… npm run test:sdk:read` / `test:sdk:write` | Live calls to your Zapier account; `:write` creates + deletes a real Zapier Table | `npx @zapier/zapier-sdk-cli login` |
| **Protocol** | `… npm test` (tier 1) with the dev server up | Auto-detects the dev server, runs A2A + MCP + agent-card discovery | agents server running |
| **E2E (browser)** | `cd packages/web && npx playwright test` | Web flows end-to-end | web + agents servers |

CI runs the mocked tiers, a `next build` for web, Biome lint, a dependency-uniqueness check, and a generated-DB-types freshness check on every push and PR.

> Keeping the action layer current: `npm run sdk:check` reports whether `@zapier/zapier-sdk` / `@zapier/zapier-sdk-cli` are behind the latest release — see [Working with the Zapier SDK](#-working-with-the-zapier-sdk).

---

## 🔭 Inspect & tune the agents (Mastra Studio)

Foreman runs on [Mastra](https://mastra.ai), so you can open it in **Mastra Studio** — a browser dashboard for working with the agents directly, without the web app. Useful for tuning prompts or seeing what an agent did on a run.

```bash
npx supabase start                   # local Supabase — backs memory + traces
cd packages/agents && npm run dev    # agent server + Studio → http://localhost:4111
```

What you get:

- 💬 **Chat** with Foreman directly — and the tool-isolated sub-agents it spawns on the harness (uses your `ANTHROPIC_API_KEY`)
- ✏️ **Edit & version the system prompt** — change an agent's instructions live, save a draft, publish; or use Foreman's own agent editor at [`localhost:3000/editor`](http://localhost:3000/editor)
- 🧠 **Memory & threads** — every conversation, persisted to your local Supabase
- 🔭 **Traces** — per-run agent / tool / LLM spans, so you can see each step an agent took
- 🗂️ **Tools** — browse the 26 Zapier SDK tools + the custom tools each agent loads
- ✅ **Eval scorers** — score runs against the `foreman-baseline-v1` dataset (relaxed-trajectory match + an LLM judge) in the Scores view

---

## ☁️ Deployment

Foreman is **deploy-anywhere by design.** It's a Mastra app, so `DEPLOY_TARGET` + env vars select the **provider** for each part — database, embeddings, filesystem, sandbox, pub/sub. You choose the host; you point the env vars (or Vercel Marketplace integrations) at whatever you're running (for example, your Supabase cloud instead of local).

| Host | Runs | What you wire |
|---|---|---|
| **Local** (dev) | Full | Local Supabase, `fastembed`, LocalFilesystem/Sandbox, in-process pub/sub — zero cloud accounts. |
| **Vercel** (serverless) | Most features | `npm run build:vercel`. Point env vars / [Vercel Marketplace](https://vercel.com/marketplace) at cloud providers — Supabase Postgres (with a pooler), OpenAI embeddings, S3/AgentFS filesystem, Upstash Redis pub/sub. Channels run **webhook-native**; the scheduler runs as **Vercel Cron**. Function time and bundle limits depend on your Vercel **plan** (Hobby / Pro / Enterprise) — that's your choice, not a Foreman limit. |
| **Mastra Cloud** | Full | Mastra's hosted platform (Observe / Server / Studio) — purpose-built for Mastra agents. |
| **VPS / container** (Coolify, Docker, Fly, Render…) | Full | A long-running container. Cloud or self-hosted Postgres; the durable-automation worker runs continuously. The traditional full-stack target. |

> The provider-swap layer is still being finished — some parts are already env-selectable (Postgres, the workspace sandbox), others are in progress (cloud filesystem, an env-selectable embedder, Redis pub/sub, hosted sandbox, webhook-native channels). The web frontend is a standard Next.js app (Vercel by default). A **one-click deploy** is on the roadmap.

### Sandbox isolation

The agent can run commands in a per-tenant workspace sandbox. Two env vars control it:

| Var | Default | What it does |
|---|---|---|
| `SANDBOX_PROVIDER` | `local` | Which sandbox backend to build. `local` is wired today; `docker` / `e2b` / `daytona` are recognized and error clearly until the provider package lands. |
| `FOREMAN_SANDBOX_ISOLATION` | `auto` | OS-level isolation. `auto` uses the platform's backend when one exists, `require` insists on one, `off` opts out explicitly. |

**Isolation is on by default, and production fails closed.** On `auto`, if no isolation backend is available Foreman refuses to start the sandbox when `NODE_ENV=production`, and warns (but continues) in dev and test. `Dockerfile.agents` installs `bubblewrap` so the container always has a backend.

Backend by platform: **Linux** → `bwrap` (bubblewrap, installed in the image) · **macOS** → `seatbelt` (built in) · **Windows** → none. Windows dev therefore runs sandbox commands unisolated with a warning; that's a gap in Mastra's sandbox library rather than in Windows itself (which has AppContainer), tracked upstream at [mastra-ai/mastra#20304](https://github.com/mastra-ai/mastra/issues/20304).

**Live:** [foreman.otakusolutions.io](https://foreman.otakusolutions.io) (web) · [foreman-agents.otakusolutions.io](https://foreman-agents.otakusolutions.io) (agents, currently on a VPS)

---

## 🗺️ Roadmap

- 🧩 **Finish the in-progress channels** — Microsoft Teams (M365 license), WhatsApp, and iMessage (macOS host).
- ☁️ **Managed hosted version** — sign in, connect Zapier, go — no infra to run.
- 🖥️ **Desktop app** — a native Mac/Windows desktop client for chat + approvals outside the browser.
- 🏗️ **Sandbox-built live apps** — the agent writes and runs real code to build custom live dashboards from your Zapier data, embedded right in chat.

---

## ❓ FAQ

- **Do I need a Zapier account?** Yes — Foreman acts *through* Zapier. In dev mode that's a single CLI login; self-hosted, each user connects their own Zapier account via OAuth.
- **Which apps can it use?** Anything on Zapier — 10,000+. Actions are generated from the Zapier SDK, so the catalog tracks Zapier's.
- **Will it do something destructive without asking?** No. Reads run freely; every write/delete surfaces an approval card with the exact fields before it runs.
- **Self-host or hosted?** Self-hosting is first-class today — the full stack, every channel, on your own infra. A managed hosted version is coming soon.
- **What models does it use?** Claude Sonnet 4.6 for the primary agent and Haiku 4.5 for fast/cheap steps, via the swappable provider layer.
- **Is my data sent anywhere?** Self-hosted, your conversations, action history, and connected-account tokens live in *your* Postgres (tokens encrypted at rest). LLM calls go to your configured provider.
- **Does it run on Windows?** Yes — agents and web both run on Node 22, and `npm run dev` works for both (the agents server + Mastra Studio on `:4111`, the web app on `:3000`).
- **Which channels work right now?** Web, Slack, Telegram, Discord, Google Chat, GitHub, and Linear. Teams, WhatsApp, and iMessage are in progress.

---

## 🤝 Contributing

Foreman is built in the open. The developer docs — file inventory, route table, custom tools, processors, memory config, schema, prompt internals — live in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md). **The README is for orientation; `CLAUDE.md` is for working in the code.**

Issue tracking runs on **bd (beads)** with Dolt-backed sync — `bd ready` to find work, `bd create` to file it. Do not add markdown TODO lists or external trackers.

---

## 🙏 Acknowledgments

Foreman stands on the work of the teams whose tools it's built from:

- **[Mastra](https://mastra.ai/)** — the agent framework: agents, memory, evals, observability.
- **[Zapier](https://zapier.com/)** — the action layer; `@zapier/zapier-sdk` turns 10,000+ apps into tools.
- **[Vercel Chat SDK](https://chat-sdk.dev/)** — the `chat` + `@chat-adapter/*` adapters that put one agent everywhere.
- **[Supabase](https://supabase.com/)**, **[Hono](https://hono.dev/)**, **[Next.js](https://nextjs.org/)**, and **[Anthropic](https://www.anthropic.com/)** — for the database, server, frontend, and models.

---

## 📜 License

**MIT.** Copyright © 2026 Otaku Solutions.

Self-hostable today; a managed hosted version is coming soon. Questions: **hello@otakusolutions.io**.
