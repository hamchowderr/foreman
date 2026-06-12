/**
 * Poll driver scheduler — the single-process tick that drives the
 * ZapierPollSignalProvider.
 *
 * The provider itself lives on the foreman agent (a Mastra SignalProvider). It
 * deliberately has no `pollInterval` (which would auto-poll in every process the
 * agent is built in). This scheduler — run only inside cron-driver-server — is
 * the one place that calls `runDuePolls()`, self-aligned to wall-clock minute
 * boundaries (a hair after the cron driver so the two don't contend on the same
 * trigger-table read).
 */

import { zapierPollProvider } from "@/mastra/signals/zapier-poll-provider";

/**
 * Start the poll scheduler. Returns a stop function. First tick lands at the
 * next :00 + 750ms.
 */
export function startPollDriver(): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 750);
    if (next.getTime() <= now.getTime()) next.setMinutes(next.getMinutes() + 1);
    const wait = next.getTime() - now.getTime();
    timer = setTimeout(async () => {
      if (!running) {
        running = true;
        try {
          const { fired, polled } = await zapierPollProvider.runDuePolls(new Date());
          if (fired > 0) {
            console.log(`[poll-driver] fired ${fired} run(s) across ${polled} trigger(s)`);
          }
        } catch (err) {
          console.error("[poll-driver] tick failed:", err);
        } finally {
          running = false;
        }
      }
      scheduleNext();
    }, wait);
  };

  scheduleNext();
  console.log("[poll-driver] started");
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log("[poll-driver] stopped");
  };
}
