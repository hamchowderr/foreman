/**
 * foreman-bhb5 native E2E: prove the daily-digest MASTRA WORKFLOW fires via an
 * imperative Mastra schedule and stores a digest — the full native replacement for
 * the retired custom runDueSchedules. Local DB only (no Infisical, no provider key;
 * the narrate step fails soft to null without a key).
 *
 *   npx tsx --env-file=.env.local scripts/digest-workflow-e2e-probe.ts
 *
 * Seed workspace + a failed & a finished run → register a `* * * * *` schedule
 * targeting daily-digest with inputData {workspaceId, automationId} → the
 * WorkflowScheduler fires it → the workflow synthesizes + stores → getLatestDigest
 * surfaces it. Cleans up.
 */
import { Mastra } from "@mastra/core";
import { MastraCompositeStore } from "@mastra/core/storage";
import "@mastra/core/workflows/evented";
import { computeNextFireAt } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import * as store from "../src/lib/automations/store";
import { getLatestDigest } from "../src/lib/automations/store";
import { getSupabase } from "../src/lib/db";
import { dailyDigestWorkflow } from "../src/workflows/daily-digest";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing (need .env.local)");

  // Mirror Foreman's composite store (schedules must route to the Postgres default).
  const mastra = new Mastra({
    storage: new MastraCompositeStore({
      id: "probe-storage",
      default: new PostgresStore({ id: "probe-pg", connectionString }),
    }),
    workflows: { "daily-digest": dailyDigestWorkflow },
    scheduler: { enabled: true },
  });
  await mastra.startWorkers();
  console.log(`scheduler defined: ${Boolean(mastra.scheduler)}`);

  const supabase = getSupabase();
  const stamp = Math.floor(Number(process.env.PROBE_STAMP) || 1);
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ name: "bhb5 probe", slug: `bhb5-probe-${stamp}` })
    .select("id")
    .single();
  if (wsErr) throw new Error(`workspace insert: ${wsErr.message}`);
  const workspaceId = (ws as { id: string }).id;

  // A target automation with a failed + finished run, and the digest automation.
  const targetId = await store.createAutomation({
    userId: "probe",
    workspaceId,
    name: "Nightly sync",
    zapierWorkflowId: `probe:manual:${stamp}`,
    source: "",
    trigger: null,
    enabled: false,
    status: "disabled",
  });
  await store.recordRun({
    automationId: targetId,
    workspaceId,
    status: "failed",
    error: { message: "connection refused" },
  });
  await store.recordRun({ automationId: targetId, workspaceId, status: "finished" });

  const digestId = await store.createAutomation({
    userId: "probe",
    workspaceId,
    name: "Morning digest",
    zapierWorkflowId: `foreman:digest:${stamp}`,
    source: "",
    trigger: { schedule: { cron: "* * * * *" }, digest: true },
    enabled: true,
    status: "active",
  });

  // Imperative schedule → daily-digest workflow (what registerAutomationSchedule does).
  const schedules = await mastra.getStorage()?.getStore("schedules");
  if (!schedules) throw new Error("schedules store unavailable");
  const now = Date.now();
  await schedules.createSchedule({
    id: `foreman-auto-${digestId}`,
    target: {
      type: "workflow",
      workflowId: "daily-digest",
      inputData: { workspaceId, automationId: digestId },
    },
    cron: "* * * * *",
    status: "active",
    nextFireAt: computeNextFireAt("* * * * *"),
    createdAt: now,
    updatedAt: now,
  });
  console.log("registered schedule; waiting for a fire…");

  let digest: { kind?: string; headline?: string; totals?: Record<string, number> } | null = null;
  for (let i = 0; i < 27; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    digest = (await getLatestDigest(workspaceId)) as typeof digest;
    if (digest?.kind === "automation_digest") break;
  }

  const ok =
    digest?.kind === "automation_digest" &&
    (digest.totals?.failed ?? 0) >= 1 &&
    (digest.totals?.finished ?? 0) >= 1;

  console.log("\n=== VERDICT ===");
  console.log(`digest headline : ${digest?.headline ?? "(none)"}`);
  console.log(`totals f/ok     : ${digest?.totals?.failed}/${digest?.totals?.finished}`);
  console.log(
    `→ native digest : ${ok ? "PROVEN end-to-end (schedule → workflow → store)" : "NOT PROVEN"}`,
  );

  // Cleanup.
  await schedules.deleteSchedule(`foreman-auto-${digestId}`);
  await supabase.from("automation_run").delete().eq("workspace_id", workspaceId);
  await supabase.from("automation").delete().eq("workspace_id", workspaceId);
  await supabase.from("workspaces").delete().eq("id", workspaceId);
  await mastra.stopWorkers();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
