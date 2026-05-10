/**
 * Standalone entrypoint for the cron driver. Run with:
 *   node --env-file=.env.local src/cron-driver-server.ts
 *
 * Keeps a long-lived process that ticks once per minute and fires due
 * `workflow_trigger` rows. Only run a single instance — there is no
 * distributed lock.
 */
import { startCronDriver } from "./workflows/cron-driver";

const stop = startCronDriver();

const shutdown = (sig: string) => {
  console.log(`[cron-driver] received ${sig}, shutting down`);
  stop();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
