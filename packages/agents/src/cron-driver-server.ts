/**
 * Standalone entrypoint for the trigger drivers. Run with:
 *   node --env-file=.env.local src/cron-driver-server.ts
 *
 * Keeps a long-lived process that ticks once per minute and fires due
 * `workflow_trigger` rows: the cron driver (schedule matches) and the poll
 * driver (Zapier read actions returning new records). Only run a single
 * instance — there is no distributed lock.
 */
import { startCronDriver } from "./workflows/cron-driver";
import { startPollDriver } from "./workflows/poll-driver";

const stopCron = startCronDriver();
const stopPoll = startPollDriver();

const shutdown = (sig: string) => {
  console.log(`[trigger-driver] received ${sig}, shutting down`);
  stopCron();
  stopPoll();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
