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
| foreman-sd1r | `typescript` | 6.0.3 | 7.0.2 | 2 | 6.0.3 landed (stacked PR). 7.x is the native Go compiler and ships no JS compiler API (`require("typescript")` only exports the version), which breaks Next.js build type-checking and `typescript-paths` (used by `@mastra/deployer`, peer `<7`). Revisit when those support TS 7. |
| foreman-cpdh | `@types/node` | 24.13.3 | 26.4.0 | 2 | Two majors. Declared in **all three** workspaces — must move together. Confirm the target Node version first. |

## Also open, not a dependency

- **foreman-zyzk** (P2) — agents suite intermittently fails 3–4 files
  (`mastra-agent`, `lazy-init-zapier`, `slack-channel`), each passing in
  isolation and in CI. Parallel-run contention, likely the `:4112` webhook
  server binding. Not a regression from any bump.
- **`rls_auto_enable`** — exists in the production database but in **no repo
  migration**, and granted EXECUTE to `anon` and `authenticated`. The
  `20260828000000` migration revoked those grants, but the function itself is
  still there, untracked. Decide whether to drop it.
