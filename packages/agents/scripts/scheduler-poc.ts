/**
 * foreman-bhb5.1 POC: prove Mastra's native WorkflowScheduler actually fires a
 * cron workflow against local Postgres — the one thing the type research couldn't
 * confirm (does startWorkers() run + does a schedule fire locally). Throwaway.
 *
 * No LLM key, no Infisical (so no cloud-Supabase override) — local DB only:
 *   npx tsx --env-file=.env.local scripts/scheduler-poc.ts
 */
import { Mastra } from "@mastra/core";
import "@mastra/core/workflows/evented";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";

let fired = 0;
const tick = createStep({
  id: "tick",
  inputSchema: z.object({}),
  outputSchema: z.object({ n: z.number() }),
  execute: async () => {
    fired += 1;
    console.log(`  [poc] workflow FIRED #${fired} @ ${new Date().toISOString()}`);
    return { n: fired };
  },
});

const wf = createWorkflow({
  id: "poc-cron",
  inputSchema: z.object({}),
  outputSchema: z.object({ n: z.number() }),
  schedule: { cron: "* * * * *", timezone: "UTC" }, // every minute at :00
})
  .then(tick)
  .commit();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing (need .env.local)");
  const storage = new PostgresStore({ id: "poc-pg", connectionString });

  const mastra = new Mastra({ storage, workflows: { "poc-cron": wf } });

  console.log(`start @ ${new Date().toISOString()}`);
  await mastra.startWorkers();
  console.log(`scheduler defined after startWorkers(): ${Boolean(mastra.scheduler)}`);

  // Confirm the schedule row was written.
  try {
    const schedules = (await storage.getStore("schedules")) as {
      listSchedules?: () => Promise<unknown[]>;
    };
    const rows = (await schedules.listSchedules?.()) ?? [];
    console.log(`mastra_schedules rows: ${rows.length}`);
  } catch (e) {
    console.log(`listSchedules probe: ${(e as Error).message}`);
  }

  // Wait up to ~135s to catch at least one top-of-minute fire.
  for (let i = 0; i < 27; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    if (fired >= 1) break;
  }

  console.log("\n=== VERDICT ===");
  console.log(`scheduler ran      : ${mastra.scheduler ? "YES ✓" : "NO ✗"}`);
  console.log(`workflow fired     : ${fired >= 1 ? `YES ✓ (${fired}×)` : "NO ✗ (timed out)"}`);
  console.log(
    `→ native scheduler : ${mastra.scheduler && fired >= 1 ? "PROVEN locally" : "NOT PROVEN — see above"}`,
  );

  // Clean up the poc schedule so it doesn't linger / re-fire.
  try {
    const s = (await storage.getStore("schedules")) as {
      listSchedules?: () => Promise<Array<{ id: string }>>;
      deleteSchedule?: (id: string) => Promise<void>;
    };
    for (const row of (await s.listSchedules?.()) ?? []) {
      if (String(row.id).includes("poc-cron")) await s.deleteSchedule?.(row.id);
    }
    console.log("cleaned up poc schedule");
  } catch (e) {
    console.log(`cleanup note: ${(e as Error).message}`);
  }

  await mastra.stopWorkers();
  process.exit(mastra.scheduler && fired >= 1 ? 0 : 1);
}

main().catch((e) => {
  console.error("poc failed:", e);
  process.exit(1);
});
