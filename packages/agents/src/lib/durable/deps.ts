/**
 * Aged dependency pins for the durable sandbox.
 *
 * Zapier runs durable source in a Vercel sandbox that installs deps with
 * `pnpm install --config.minimumReleaseAge=1440`, so any direct dependency
 * published less than 24h ago is REJECTED. `@zapier/zapier-sdk` publishes several
 * times a day, so its npm-latest is regularly too young. These are the latest
 * versions of each that were >=24h old on 2026-06-25 and proven end-to-end by the
 * durable PoC capstone (foreman-l7xq) — runDurable + publishWorkflowVersion +
 * triggerWorkflow all succeeded against this set.
 *
 * `@zapier/zapier-sdk` and `zod` are passed in `dependencies` (the source imports
 * them); `@zapier/zapier-durable` is passed via `zapierDurableVersion`. None of
 * these are Foreman runtime deps — they only ever go to Zapier's sandbox as call
 * arguments. A later milestone can resolve these live (the >=24h selector) instead
 * of pinning constants.
 */
export const AGED_DURABLE_DEPS = {
  sdk: "0.79.0",
  durable: "0.6.1",
  zod: "4.4.3",
} as const;
