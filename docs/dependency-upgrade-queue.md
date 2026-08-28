# Dependency upgrade queue

Snapshot of `npm outdated` on 2026-08-28, after Mastra and Zapier were brought
current. Tracked in beads under the umbrella **foreman-8vf4**; this file is the
git-readable mirror, because the beads Dolt DB does not sync across machines.

`Wanted` equals `Current` for every row below, so **`npm update` will not touch
any of them** — each needs a deliberate range bump in `package.json`.

## Already current (do not re-file)

All 16 `@mastra/*` packages (core/deployer/server at 1.63.0, CLI at 1.27.0) and
all four Zapier packages (SDK 0.103.0, CLI 0.77.8, durable 0.12.6, mcp 0.21.9).
`ai`, `@ai-sdk/react`, `@supabase/supabase-js`, `hono`, `pg` and `tokenx` no
longer appear in `npm outdated`.

## Queue

| Issue | Package | Current | Latest | P | Notes |
|---|---|---|---|---|---|
| foreman-fwhi | `@supabase/ssr` | 0.10.3 | 0.12.5 | 1 | Web auth layer (`lib/server.ts`, `lib/client.ts`, `lib/middleware.ts`). A regression logs everyone out — verify sign-up, login, password reset and session refresh by hand, not just the build. |
| foreman-9qa8 | safe tier | — | — | 2 | `next` 16.2.12→16.3.3, `@biomejs/biome` 2.5.4→2.5.11, `ansi-to-react` 6.1.6→6.2.6, `react-data-grid` beta.47→beta.61. Patch/minor; ship as one PR. |
| foreman-sd1r | `typescript` | 5.9.3 | 7.0.2 | 2 | Two majors. Highest risk in the tree; do alone. No new `@ts-expect-error` to silence real errors. |
| foreman-cpdh | `@types/node` | 24.13.3 | 26.4.0 | 2 | Two majors. Declared in **all three** workspaces — must move together. Confirm the target Node version first. |
| foreman-47vg | `framer-motion` + `motion` | 12.43.0 | 13.1.1 | 2 | Same library, two names, both in `packages/web`. Bumping one alone ships two copies. |
| foreman-2vo2 | `shiki` | 3.23.0 | 4.4.3 | 3 | Major; theme/loader API has moved before. Check code blocks in both themes. |
| foreman-ecwn | `sonner` | 1.7.4 | 2.0.8 | 3 | Major; v2 changed the API surface. |
| foreman-0ixs | `jsdom` | 29.1.1 | 30.0.1 | 3 | Test env. Suite is already flaky (foreman-zyzk) — get a clean baseline first so a real regression is distinguishable. |
| foreman-k3g1 | `nanoid` | 5.1.16 | 6.0.1 | 3 | Web-only (nested install). Check the ESM/CJS export shape, which broke consumers on 3→4. |
| foreman-j0g1 | `fumadocs-mdx` | 14.3.2 | 15.4.0 | 3 | Major; config format and source adapter have changed across majors. |
| foreman-5qml | `chat-adapter-imessage` | 0.1.1 | 1.1.0 | 3 | 0.x→1.x, so no semver protection. Confirm the adapter is still wanted — if it's dead weight, remove rather than upgrade. |
| foreman-k152 | `@testing-library/jest-dom` | 6.9.1 | 7.0.1 | 3 | Test-only; v7 dropped deprecated matchers. |

## Also open, not a dependency

- **foreman-zyzk** (P2) — agents suite intermittently fails 3–4 files
  (`mastra-agent`, `lazy-init-zapier`, `slack-channel`), each passing in
  isolation and in CI. Parallel-run contention, likely the `:4112` webhook
  server binding. Not a regression from any bump.
- **`rls_auto_enable`** — exists in the production database but in **no repo
  migration**, and granted EXECUTE to `anon` and `authenticated`. The
  `20260828000000` migration revoked those grants, but the function itself is
  still there, untracked. Decide whether to drop it.
