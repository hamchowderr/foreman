# Agent scripts

Operational, eval, and probe scripts for the agents package. Most are run through
the npm scripts in `packages/agents/package.json`; a few are standalone probes run
directly with `npx tsx`.

**Prerequisites**

- A `packages/agents/.env.local` with the secrets the script needs. Scripts load it
  via `--env-file=.env.local` (or `npx tsx --env-file=.env.local …`) — **no
  credentials are hardcoded**. Common keys: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, and (for the
  Zapier probes) a logged-in Zapier SDK session + `ZAPIER_ACCOUNT_ID`.
- A running local Supabase (`npx supabase start` from the repo root) for anything
  that touches Postgres.

## Evaluation / datasets

The Mastra Datasets pipeline that scores the agent against a labeled set (see the
"Evaluation pipeline" section in the repo `CLAUDE.md`). Run from `packages/agents`:

| Command | Purpose |
|---|---|
| `npm run datasets:smoke` | Build/validate a tiny dataset slice |
| `npm run datasets:load-raw` | Load the raw dataset items |
| `npm run datasets:label` | Label items with `category_hint` / `expected_behavior` |
| `npm run datasets:set-trajectory` / `:set-context` / `:fix-input` | Dataset field fixups |
| `npm run datasets:mini-experiment` | 2-item smoke before paying for the full run |
| `npm run datasets:experiment -- --full` | Full 80-item experiment (uses real model calls) |
| `npm run datasets:analyze` | Per-scorer averages + per-category breakdown + worst-10 |

## App catalog & embeddings

| Command | Purpose |
|---|---|
| `npm run catalog:seed` | Seed the Zapier app catalog into local Postgres (`seed-catalog.ts`) |
| `npm run catalog:seed:quick` | Apps only (skip actions) |
| `npm run catalog:embed` | Compute catalog embeddings only |
| `npm run embeddings:reindex` | Rebuild the action-history embeddings index |

## Ops / debugging

| Command | Purpose |
|---|---|
| `npm run logs` / `logs:watch` | Tail recent agent activity from the DB (`show-logs.mjs`) |
| `npm run verify:aimock` | Check AIMock fixture coverage for the mocked tests |

`show-logs.mjs` reads `DATABASE_URL` (falls back to the local Supabase default).

## Dev seed SQL

Hand-run against the local Supabase Postgres to populate UI surfaces that need data
before they render anything worth looking at. Pipe them in with:

```bash
docker exec -i supabase_db_foreman psql -U postgres -d postgres < scripts/<file>.sql
```

| File | Purpose |
|---|---|
| `seed-automations-verify.sql` | One automation + finished/failed/started runs for verifying `/automations` polling and drill-down. Self-contained (creates its own workspace + user). |
| `seed-automations-verify-down.sql` | Teardown for the above |
| `seed-dashboard-snapshot.sql` | One `app_data_snapshot` so `/dashboards` renders; attaches to the oldest `user` row |

These are dev-only fixtures — never run them against a shared or deployed database.

## Zapier durable / trigger-inbox probes (standalone)

Manual harness + probes for the Zapier experimental durable-workflow and
trigger-inbox surfaces. These need a Zapier account with durable early access, a
logged-in SDK session, and `ZAPIER_ACCOUNT_ID` set (your numeric catch-hook account
segment — find it in a Zapier catch-hook URL: `hooks.zapier.com/hooks/catch/<ACCOUNT_ID>/<code>/`).
Run with `npx tsx --env-file=.env.local scripts/<name>.ts`.

| Script | Purpose |
|---|---|
| `durable-loop-smoke.ts` | End-to-end: deploy durable → inbox trigger → event → worker → run (live) |
| `durable-smoke.ts` | Minimal ephemeral durable run (echo) |
| `durable-write-roundtrip.ts` | create → publish → trigger → delete a durable workflow |
| `durable-endpoints-probe.ts` | Probe which durable/workflow endpoints are reachable under each auth |
| `durable-pkce-probe.ts` | Probe the PKCE userJwt auth path against durable endpoints |
| `probe-connections.ts` | List the account's connected apps + connection fields |
| `probe-webhook-inbox.ts` | Probe instant webhook delivery into a trigger-inbox |
| `sdk-surface-sweep.ts` | Enumerate the installed Zapier SDK method surface |
| `trigger-inbox-spike.ts` | Spike: ensure/lease/ack/drain a trigger-inbox |

> These probes hit a real Zapier account and may create/delete cloud resources.
> They self-clean, but run them against a non-sensitive test account.

## Root scripts (`/scripts`)

| Command | Purpose |
|---|---|
| `npm run check:deps` (root) | Fail the install if `@mastra/*` versions diverge (`check-dep-uniqueness.mjs`) |
| `npm run sdk:check` (root) | Watch for new Zapier SDK/CLI releases (`zapier-sdk-watch.mjs`) |
| `npm run dead-code` (root) | Fallow dead-code report |
