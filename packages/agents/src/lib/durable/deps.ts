/**
 * Aged dependency pins for the durable sandbox.
 *
 * Zapier runs durable source in a Vercel sandbox that installs deps with
 * `pnpm install --config.minimumReleaseAge=1440`, so any direct dependency
 * published less than 24h ago is REJECTED. `@zapier/zapier-sdk` publishes several
 * times a day, so its npm-latest is regularly too young. These are the newest
 * stable versions of each that were >=24h old as of 2026-08-17, selected by
 * publish DATE (not semver — `@zapier/zapier-sdk` has an ancient 1.1.0 that
 * out-sorts the live 0.x line).
 *
 * 2026-08-17 (foreman-h54f): sdk 0.84.4 -> 0.101.1, durable 0.9.1 -> 0.12.5.
 * The previous set was never verified live; it is now. `scripts/durable-pins-probe.ts`
 * exercises the real path against Zapier — runDurable, then createWorkflow +
 * publishWorkflowVersion + triggerWorkflow + delete — and both pin sets pass.
 * Re-run that probe whenever these move; the mocked suite cannot see a sandbox
 * install failure or a runtime-engine rejection.
 *
 * `@zapier/zapier-sdk` and `zod` are passed in `dependencies` (the source imports
 * them); `@zapier/zapier-durable` is passed via `zapierDurableVersion`. None of
 * these are Foreman runtime deps — they only ever go to Zapier's sandbox as call
 * arguments. A later milestone can resolve these live (the >=24h selector) instead
 * of pinning constants.
 */
export const AGED_DURABLE_DEPS = {
  sdk: "0.101.1",
  durable: "0.12.5",
  zod: "4.4.3",
} as const;
