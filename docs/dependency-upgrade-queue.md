# Dependency upgrade queue

Snapshot of `npm outdated` on 2026-08-28, after Mastra and Zapier were brought
current. Tracked in beads under the umbrella **foreman-8vf4**; this file is the
git-readable mirror, because the beads Dolt DB does not sync across machines.

`Wanted` equals `Current` for every row below, so **`npm update` will not touch
any of them** — each needs a deliberate range bump in `package.json`.

## Already current (do not re-file)

All 16 `@mastra/*` packages (core/deployer/server at 1.80.0, CLI at 1.36.0) and
`next` 16.4.3 as of 2026-10-30. The Zapier SDK 0.115.1 + CLI 0.86.7 (mcp 0.27.7,
transitive) as of 2026-10-13.
`@zapier/zapier-durable` 0.14.1, zod 4.6.7, and the former safe tier (foreman-9qa8:
`next` 16.4.0 (since 16.4.3), `@biomejs/biome` 2.5.15, `ansi-to-react` 6.2.6, `react-data-grid`
beta.61) also landed in the same PR.
`ai`, `@ai-sdk/react`, `@supabase/supabase-js`, `hono`, `pg` and `tokenx` no
longer appear in `npm outdated`.

## Queue

| Issue | Package | Current | Latest | P | Notes |
|---|---|---|---|---|---|
| foreman-sd1r | `typescript` | 6.0.3 | 7.0.2 | 2 | 6.0.3 landed (stacked PR). 7.x is the native Go compiler and ships no JS compiler API (`require("typescript")` only exports the version), which breaks Next.js build type-checking and `typescript-paths` (used by `@mastra/deployer`, peer `<7`). Revisit when those support TS 7. |
| foreman-cpdh | `@types/node` | 24.13.3 | 26.4.0 | 2 | Two majors. Declared in **all three** workspaces — must move together. Confirm the target Node version first. |

## Also open, not a dependency

- ~~**foreman-zyzk**~~ (fixed) — `mastra-agent`, `lazy-init-zapier` and
  `slack-channel` failed intermittently under a parallel full run. Not the
  `:4112` webhook server (none of the three binds a port): each cold-imports
  the Mastra/Foreman module tree inside a test body, which takes ~10s pinned to
  one CPU and can blow the test timeout on a busy machine (`slack-channel`'s
  import sat under the 5s default). The imports now run in `beforeAll` hooks
  with a 120s budget (or, for the lazy-init check that must import in-test, a
  120s test timeout).
- **`rls_auto_enable`** — exists in the production database but in **no repo
  migration**, and granted EXECUTE to `anon` and `authenticated`. The
  `20260828000000` migration revoked those grants, but the function itself is
  still there, untracked. Decide whether to drop it.
