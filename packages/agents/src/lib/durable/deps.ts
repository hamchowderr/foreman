/**
 * Aged dependency pins for the durable sandbox.
 *
 * Zapier runs durable source in a Vercel sandbox that installs deps with
 * `pnpm install --config.minimumReleaseAge=1440`, so any direct dependency
 * published less than 24h ago is REJECTED. `@zapier/zapier-sdk` publishes several
 * times a day, so its npm-latest is regularly too young. These are the newest
 * stable versions of each that were >=24h old as of 2026-07-14, selected by
 * publish DATE (not semver — `@zapier/zapier-sdk` has an ancient 1.1.0 that
 * out-sorts the live 0.8x line). npm-latest sdk 0.85.0 was only ~3h old then, so
 * 0.84.4 is the aged pick. Durable moved 0.6.1 -> 0.9.1 in this pass; unlike the
 * original set (proven end-to-end by the foreman-l7xq capstone — runDurable +
 * publishWorkflowVersion + triggerWorkflow), the 0.9.x bump still needs a live
 * runDurable/publishWorkflowVersion to re-prove end-to-end.
 *
 * `@zapier/zapier-sdk` and `zod` are passed in `dependencies` (the source imports
 * them); `@zapier/zapier-durable` is passed via `zapierDurableVersion`. None of
 * these are Foreman runtime deps — they only ever go to Zapier's sandbox as call
 * arguments. A later milestone can resolve these live (the >=24h selector) instead
 * of pinning constants.
 */
export const AGED_DURABLE_DEPS = {
  sdk: "0.84.4",
  durable: "0.9.1",
  zod: "4.4.3",
} as const;
