/**
 * Standalone entrypoint for the trigger-inbox worker (foreman-l7xq M3). Run with:
 *   npm run start:inbox-worker   (npx tsx --env-file=.env.local src/inbox-worker-server.ts)
 *
 * Long-lived process: every cycle it leases each active inbox-triggered
 * automation's trigger-inbox, dedups (claimInboxMessage), fires the durable via
 * triggerWorkflow, records the run, and acks. Single instance only — there is no
 * distributed lock (matches the removed cron-driver-server). Cadence via
 * FOREMAN_INBOX_WORKER_INTERVAL_MS (default 60000).
 */
import { startInboxWorker } from "./lib/automations/worker";
import { getMastra } from "./mastra";

// Construct the agent in THIS process so the experimental SDK / registry init
// happens here (mirrors how cron-driver-server built Mastra in-worker).
getMastra();

const intervalMs = Number(process.env.FOREMAN_INBOX_WORKER_INTERVAL_MS) || 60_000;
console.log(`[inbox-worker] starting · interval ${intervalMs}ms`);
const stop = startInboxWorker(intervalMs);

const shutdown = (sig: string) => {
  console.log(`[inbox-worker] received ${sig}, shutting down`);
  stop();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
