# Testing & Database Rules

- **Mocked tests must not need real provider keys.** CI runs with keys absent;
  anything reaching a non-mocked path must fail loudly, not silently hit a real
  API. AIMock starts in-process via `tests/aimock-setup.ts`.
- **Test tiers:** `npm test` (mocked unit/integration) runs in CI; `test:sdk` and
  `test:live` are opt-in and need real credentials — never wire them into CI.
- **Regenerate DB types with the workspace flag.** After a schema/migration change
  run `npm run db:types` (from `packages/agents`); it uses `--workdir ../..` so the
  CLI finds the root `supabase/config.toml`. CI diffs it via `db:types:check`.
  Start the local stack (`npx supabase start`) first.
- **Schema is generated, not hand-written.** `src/lib/db/database.types.ts` is
  codegen — edit migrations in `supabase/migrations/`, then regenerate; never
  hand-edit the types.
