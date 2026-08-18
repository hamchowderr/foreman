/**
 * Standalone entrypoint for the trigger-inbox worker (foreman-l7xq M3). Run with:
 *   npm run start:inbox-worker   (npx tsx --env-file=.env.local src/inbox-worker-server.ts)
 *
 * Long-lived process: holds one `watchTriggerInbox` SSE subscription per active
 * inbox-triggered automation, dedups each message (claimInboxMessage), fires the
 * durable via triggerWorkflow and records the run. Zapier's SDK owns the
 * lease/ack/release loop (foreman-em74) — messages arrive on a notification, not
 * a poll tick. Single instance only — there is no distributed lock.
 *
 * FOREMAN_INBOX_WORKER_INTERVAL_MS (default 60000) no longer paces delivery. It
 * paces the two housekeeping passes: re-checking which automations should be
 * subscribed, and advancing already-fired runs to their terminal status.
 */
import { startInboxWatcher } from "./lib/automations/worker";
import { getMastra } from "./mastra";

// Construct the agent in THIS process so the experimental SDK / registry init
// happens here (mirrors how cron-driver-server built Mastra in-worker).
const mastra = getMastra();

// Run Mastra's workers here (foreman-bhb5): the WorkflowScheduler that fires
// cron schedules (daily-digest / run-automation) + the evented workflow executor
// that runs them. This dedicated long-lived process is the natural home; the CAS
// on mastra_schedules makes it safe even if the web server also runs them.
mastra.startWorkers().catch((err) => {
  console.error("[inbox-worker] startWorkers failed:", err);
});

const intervalMs = Number(process.env.FOREMAN_INBOX_WORKER_INTERVAL_MS) || 60_000;
console.log(`[inbox-worker] starting · SSE subscriptions · housekeeping ${intervalMs}ms`);
const stop = startInboxWatcher({
  refreshIntervalMs: intervalMs,
  reconcileIntervalMs: intervalMs,
});

const shutdown = (sig: string) => {
  console.log(`[inbox-worker] received ${sig}, shutting down`);
  stop();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
