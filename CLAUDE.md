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
- **Auth model** — which auth (client-creds vs per-user userJwt) works on which SDK surface, and why durable is internal-scope-walled: [`docs/zapier-auth-model.md`](docs/zapier-auth-model.md)

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
- **Generated types**: `agents/src/lib/db/database.types.ts` is codegen'd from the live local DB. Regenerate with `cd packages/agents && npm run db:types`; CI diffs it via `db:types:check` (the `db types fresh` job). Both run `supabase gen types --local --workdir ../..`. The **`--workdir ../..` is required**: the scripts run from `packages/agents` but `supabase/config.toml` is at the repo root, so plain `--local` can't find the stack and silently falls back to the cloud/token path (`"Access token not provided"`, empty output). Do **NOT** swap in `--db-url`: newer CLIs introspect via a `postgres-meta` container that can't reach the host's `127.0.0.1` in CI (works on Windows Docker, fails on Linux). Run `npx supabase start` first.
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

## Evaluation pipeline

Foreman uses Mastra's Datasets API to score the agent against a labeled set of real-world automation requests.

- **Dataset:** `foreman-baseline-v1` — 80 items sourced from Zapier community + templates, each tagged with `category_hint` and `expected_behavior`.
- **Scorers** (`agents/src/lib/scorers/`):
  - `foreman-trajectory.ts` — relaxed-subsequence match of expected vs. actual tool calls; reads `MastraDBMessage.content.parts` (the modern Mastra shape).
  - `foreman-llm-judge.ts` — Haiku 4.5 grades the agent's text response against `groundTruth.expected_behavior`. Catches text-quality regressions trajectory can't.
- **Scripts** (run from `packages/agents`):
  - `npm run datasets:smoke` / `:load-raw` / `:label` — dataset construction
  - `npm run datasets:mini-experiment` — 2-item smoke before paying for full
  - `npm run datasets:experiment -- --full` — full 80
  - `npm run datasets:analyze` — per-scorer averages, per-category breakdown, worst-10 items with judge reasoning
- **Storage:** scorer rows live in the `scores` storage domain (Postgres) keyed by `runId = experimentId`. `datasets:analyze` joins via `scoresStore.listScoresByRunId`.

## CI

`.github/workflows/test.yml` runs four jobs on every push to `main` and every PR:

| Job | What |
|---|---|
| **agents** | `npm test` — vitest workspace projects. AIMock starts in-process via `tests/aimock-setup.ts` globalSetup. |
| **web** | `next build` for `packages/web` (also type-checks). |
| **lint** | `npm run lint` — Biome. |
| **deps** | `npm ci` — postinstall runs `scripts/check-dep-uniqueness.mjs`. |

Real provider keys are deliberately absent from CI. Anything that leaks into a non-mocked path fails loudly.

## Dev runbook

For requirements, full quick-start, env vars, ngrok, deployment, and the testing tier table — see [README.md](README.md). This file is for navigating the codebase; the README is for running it.

## Versioning & Tagging

Foreman uses **SemVer** (`MAJOR.MINOR.PATCH`) with **annotated** git tags at release points.

- **Tag releases on `main` only** — never on `feature/`/`fix/`/`chore/` branches or arbitrary commits. A tag is a permanent name on one commit; cut one at deploy-worthy milestones, not every push.
- **Cut a release:** bump `package.json` `version` → commit `chore(release): vX.Y.Z` → `git tag -a vX.Y.Z -m "..."` on that commit (annotated, not lightweight — annotated stores author/date/notes; releases and `git describe` need it).
- **Push tags explicitly:** `git push origin main --follow-tags` (a plain `git push` does NOT send tags — the usual gotcha). Optional: `gh release create vX.Y.Z --generate-notes` for a GitHub Release.
- **Pre-1.0 (`0.x`):** bump MINOR for features *or* breaking changes, PATCH for fixes; no stability promise until `v1.0.0`.
- Keep `package.json` `version` and the tag **in lockstep**. Current: `0.1.0`, **no tags yet** — first baseline tag (`v0.1.0`) pending.

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
