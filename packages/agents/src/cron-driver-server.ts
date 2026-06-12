/**
 * Standalone entrypoint for the trigger drivers. Run with:
 *   node --env-file=.env.local src/cron-driver-server.ts
 *
 * Keeps a long-lived process that ticks once per minute and fires due
 * `workflow_trigger` rows: the cron driver (schedule matches) and the poll
 * driver (Zapier read actions returning new records). Only run a single
 * instance — there is no distributed lock.
 */
import { getMastra } from "./mastra";
import { zapierPollProvider } from "./mastra/signals/zapier-poll-provider";
import { startCronDriver } from "./workflows/cron-driver";
import { startPollDriver } from "./workflows/poll-driver";

// Build the Mastra instance here so the foreman agent is constructed in THIS
// worker process — that connects the SignalProviders (poll/channel) and gives
// them the notification storage notify() needs. Without it, runDuePolls() fires
// workflows fine but notifyOwner() is a silent no-op (no connected agent). The
// provider has no pollInterval, so constructing the agent here doesn't start a
// second poll loop. (foreman notify-wiring)
getMastra();
console.log(`[trigger-driver] poll provider connected: ${zapierPollProvider.isConnected}`);

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
