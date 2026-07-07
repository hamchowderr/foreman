import { READ_ONLY_TOOL_IDS } from "./zapier-sdk-tools";

/**
 * Agent-level background-execution opt-in for read-only tools (foreman-7am4).
 *
 * Spread `backgroundTasks: backgroundToolsConfig()` onto the Foreman agent to run
 * its read-only tools (the Zapier reads + search_history) as Mastra background
 * tasks: the agentic loop dispatches them and — via `/chat`'s `streamUntilIdle` —
 * folds the result back into the SAME response instead of blocking on a slow read.
 *
 * Why agent-level (not the tool's own `background` config): Foreman resolves tools
 * lazily (`tools: () => buildForemanTools()`, required to avoid the createZapierSdk
 * startup hang). Under that DynamicArgument resolver the per-tool `background`
 * field never reaches the background-task manager, so tools run synchronously;
 * the agent-level `backgroundTasks.tools` map DOES drive dispatch. Verified live:
 * with this, search_history emits background-task-running → -completed and its
 * result injects on the continuation turn.
 *
 * Write/destructive tools are intentionally excluded (READ_ONLY_TOOL_IDS only) so
 * the proposal/approval flow stays synchronous. `waitTimeoutMs` caps how long the
 * loop waits before moving on; a task that outlives it injects on a later turn.
 *
 * No env gate — the old `toJSONSchema` infinite-loop hang is fixed on the current
 * Mastra alpha. (Enabling background does make Studio introspect those schemas at
 * `mastra dev` startup, but that's a dev-playground cost only; production runs no
 * Studio.)
 */
const BACKGROUND_WAIT_TIMEOUT_MS = 30_000;

/** Custom (non-Zapier) read-only tools that should also run in the background. */
const CUSTOM_BACKGROUND_TOOL_IDS = ["search_history"];

export function backgroundToolsConfig() {
  const ids = [...READ_ONLY_TOOL_IDS, ...CUSTOM_BACKGROUND_TOOL_IDS];
  return {
    tools: Object.fromEntries(ids.map((id) => [id, { enabled: true }])),
    waitTimeoutMs: BACKGROUND_WAIT_TIMEOUT_MS,
  };
}
