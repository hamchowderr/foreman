# Zapier SDK Rules

The agent's Zapier tools are auto-generated from the SDK registry in
`packages/agents/src/lib/zapier-sdk-tools.ts`. When touching that path or calling
the SDK:

- **Never guess parameter names.** Read them from the SDK's Zod schema in the
  registry. Known traps: table ops take `table` (not `tableId`); record creation
  wraps each record as `{ data: {...} }`.
- **Trigger inboxes are keyed on `key`, not `name`.** `name` is a deprecated
  alias as of SDK 0.81.0. Pass `key` to `ensureTriggerInbox` / `createTriggerInbox`
  and filter with `key` (see `lib/trigger-inbox/`).
- **Classify every registry method.** Each method belongs to exactly one of
  `APPROVAL_REQUIRED` (write/destructive → `requireApproval`), `READ_ONLY` (safe
  reads), or `EXCLUDED_METHODS` (deprecated wrappers + surfaces we don't expose).
  An unclassified method silently becomes a no-approval agent tool — when an SDK
  bump adds a method, assign its set before shipping.
- **Don't re-add deprecated/blocking methods.** `request`, the `*Authentication`
  duplicates, the `*InputField*` aliases, and the blocking
  `createConnection` / `waitForNewConnection` helpers stay in `EXCLUDED_METHODS`.
- After bumping the SDK, run `npm run sdk:check` and the `zapier-sdk-tools` unit
  test; confirm the registry-method count still equals the sum of the three sets.
