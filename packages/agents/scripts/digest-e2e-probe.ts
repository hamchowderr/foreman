/**
 * foreman-ufo3 end-to-end proof against live local Supabase. The digest path needs
 * NO Zapier (deterministic synthesis), so the whole acceptance runs locally:
 *   seed a workspace + a failed & a finished run
 *   → provisionAutomation(schedule+digest) creates a digest automation (no durable)
 *   → runDueSchedules fires it → synthesizes → records a finished digest run
 *   → store.getLatestDigest surfaces it (the JSONB kind lookup the /inbox uses)
 * Proves "a scheduled daily digest runs and populates the inbox with a prioritized
 * summary" (the ufo3 acceptance). Cleans up everything it creates.
 *
 * Run (packages/agents): npx tsx --env-file=.env.local scripts/digest-e2e-probe.ts
 */

import { provisionAutomation } from "../src/lib/automations/service";
import * as store from "../src/lib/automations/store";
import { getLatestDigest } from "../src/lib/automations/store";
import { runDueSchedules } from "../src/lib/automations/worker";
import { getSupabase } from "../src/lib/db";

async function main() {
  const supabase = getSupabase();
  const stamp = Math.floor(Number(process.env.PROBE_STAMP) || 1);
  const slug = `ufo3-probe-${stamp}`;

  // 1) Workspace.
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ name: "ufo3 probe", slug })
    .select("id")
    .single();
  if (wsErr) throw new Error(`workspace insert: ${wsErr.message}`);
  const workspaceId = (ws as { id: string }).id;
  console.log(`workspace ${workspaceId}`);

  // 2) A target automation (manual, no Zapier) + a failed & a finished run to summarize.
  const targetId = await store.createAutomation({
    userId: "probe-user",
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

  // 3) The digest automation — schedule + digest, no durable deployed.
  const digestAuto = await provisionAutomation({
    userId: "probe-user",
    workspaceId,
    name: "Morning digest",
    schedule: { kind: "interval", everyMinutes: 1 },
    digest: true,
  });
  console.log(`digest automation ${digestAuto.id} (workflowId="${digestAuto.workflowId}")`);

  // 4) Fire due schedules — the worker synthesizes the digest for a never-run automation.
  const fired = await runDueSchedules(Date.now());
  const mine = fired.find((f) => f.automationId === digestAuto.id);
  console.log(`runDueSchedules → digest fired=${mine?.fired} status=${mine?.status}`);

  // 5) Surface it exactly as /inbox does.
  const latest = (await getLatestDigest(workspaceId)) as {
    kind?: string;
    headline?: string;
    totals?: Record<string, number>;
  } | null;
  console.log(`getLatestDigest → ${latest ? `"${latest.headline}"` : "NULL"}`);

  const ok =
    mine?.fired === true &&
    latest?.kind === "automation_digest" &&
    (latest.totals?.failed ?? 0) >= 1 &&
    (latest.totals?.finished ?? 0) >= 1;

  // 6) Clean up (runs first — FK).
  await supabase.from("automation_run").delete().eq("workspace_id", workspaceId);
  await supabase.from("automation").delete().eq("workspace_id", workspaceId);
  await supabase.from("workspaces").delete().eq("id", workspaceId);
  console.log("cleaned up");

  console.log("\n=== VERDICT ===");
  console.log("digest fired         :", mine?.fired ? "YES ✓" : "NO ✗");
  console.log("surfaced via inbox   :", latest?.kind === "automation_digest" ? "YES ✓" : "NO ✗");
  console.log("totals (failed/ok)   :", `${latest?.totals?.failed}/${latest?.totals?.finished}`);
  console.log("→ ufo3 acceptance    :", ok ? "PROVEN end-to-end" : "INCOMPLETE — see above");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
