/**
 * Gated background-execution config for agent tools (foreman-7am4).
 *
 * Returns `{ background: { enabled: true } }` when FOREMAN_BACKGROUND_TOOLS=1,
 * else `{}` — spread into a tool's createTool() config to opt it into Mastra
 * background execution.
 *
 * Apply ONLY to simple-schema custom tools. Live verification showed that
 * backgrounding the generated Zapier SDK tools hangs `mastra dev`: enabling
 * background makes Mastra inject a `_background` field into the tool's input
 * schema, and Studio's `toJSONSchema` introspection over the Zapier tools'
 * (pathologically complex) zod schemas then loops forever — the same failure the
 * lazy-init-zapier regression test guards. `mastra build` is unaffected (no
 * Studio introspection), but the dev playground is. Simple schemas (e.g.
 * search_history's 3 fields) inject + introspect fine.
 *
 * Read at call time so tests can toggle the flag. OFF by default — this changes
 * live tool dispatch and is alpha-unverified end-to-end, so it ships inert.
 */
export function backgroundIfEnabled(): { background?: { enabled: true } } {
  return process.env.FOREMAN_BACKGROUND_TOOLS === "1" ? { background: { enabled: true } } : {};
}
