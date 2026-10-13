# Dependency upgrade queue

Snapshot of `npm outdated` on 2026-08-28, after Mastra and Zapier were brought
current. Tracked in beads under the umbrella **foreman-8vf4**; this file is the
git-readable mirror, because the beads Dolt DB does not sync across machines.

`Wanted` equals `Current` for every row below, so **`npm update` will not touch
any of them** — each needs a deliberate range bump in `package.json`.

## Already current (do not re-file)

All 16 `@mastra/*` packages (core/deployer/server at 1.76.0, CLI at 1.34.0) and
the Zapier SDK 0.115.1 + CLI 0.86.7 (mcp 0.27.7, transitive) as of 2026-10-13.
`@zapier/zapier-durable` 0.14.1, zod 4.6.7, and the former safe tier (foreman-9qa8:
`next` 16.4.0, `@biomejs/biome` 2.5.15, `ansi-to-react` 6.2.6, `react-data-grid`
beta.61) also landed in the same PR.
`ai`, `@ai-sdk/react`, `@supabase/supabase-js`, `hono`, `pg` and `tokenx` no
longer appear in `npm outdated`.

## Queue

| Issue | Package | Current | Latest | P | Notes |
|---|---|---|---|---|---|
| foreman-fwhi | `@supabase/ssr` | 0.10.3 | 0.12.5 | 1 | Web auth layer (`lib/server.ts`, `lib/client.ts`, `lib/middleware.ts`). A regression logs everyone out — verify sign-up, login, password reset and session refresh by hand, not just the build. |
| foreman-sd1r | `typescript` | 5.9.3 | 7.0.2 | 2 | Two majors. Highest risk in the tree; do alone. No new `@ts-expect-error` to silence real errors. |
| foreman-cpdh | `@types/node` | 24.13.3 | 26.4.0 | 2 | Two majors. Declared in **all three** workspaces — must move together. Confirm the target Node version first. |
| foreman-5qml | `chat-adapter-imessage` | 0.1.1 | 1.1.0 | 3 | 0.x→1.x, so no semver protection. Confirm the adapter is still wanted — if it's dead weight, remove rather than upgrade. |

## Also open, not a dependency

- **foreman-zyzk** (P2) — agents suite intermittently fails 3–4 files
  (`mastra-agent`, `lazy-init-zapier`, `slack-channel`), each passing in
  isolation and in CI. Parallel-run contention, likely the `:4112` webhook
  server binding. Not a regression from any bump.
- **`rls_auto_enable`** — exists in the production database but in **no repo
  migration**, and granted EXECUTE to `anon` and `authenticated`. The
  `20260828000000` migration revoked those grants, but the function itself is
  still there, untracked. Decide whether to drop it.
