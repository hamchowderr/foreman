/**
 * foreman-ufo3.2 real-DB check: the digest surfacing relies on a JSONB filter
 * (`output->>kind = automation_digest`) that unit mocks can't exercise. This runs
 * the SHIPPED store.getLatestDigest against the live local Supabase and, when a
 * real automation exists, round-trips a digest run through it. Proves the query
 * syntax is accepted by PostgREST and that the kind-discriminator lookup works.
 *
 * Run (packages/agents): npx tsx --env-file=.env.local scripts/digest-query-probe.ts
 */

import { buildDigest } from "../src/lib/automations/digest";
import {
  getLatestDigest,
  listRecentRunsForWorkspace,
  recordRun,
} from "../src/lib/automations/store";
import { getSupabase } from "../src/lib/db";

async function main() {
  const supabase = getSupabase();

  // 1) The syntax check: the jsonb filter must EXECUTE (not 400) even with 0 rows.
  const bogus = await getLatestDigest("00000000-0000-0000-0000-000000000000");
  console.log(
    `getLatestDigest(bogus ws) → ${bogus === null ? "null ✓ (query accepted)" : "unexpected"}`,
  );

  // 2) Round-trip through a real automation if one exists (FKs require valid parents).
  const { data: autos } = await supabase
    .from("automation")
    .select("id, workspace_id")
    .not("workspace_id", "is", null)
    .limit(1);
  const auto = (autos ?? [])[0] as { id: string; workspace_id: string } | undefined;

  if (!auto) {
    console.log("no automation with a workspace in local DB — syntax check only.");
    console.log("→ getLatestDigest query : ACCEPTED by PostgREST");
    return;
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = await listRecentRunsForWorkspace(auto.workspace_id, since, { limit: 50 });
  console.log(`listRecentRunsForWorkspace(${auto.workspace_id}) → ${recent.length} recent run(s)`);

  const digest = buildDigest(
    recent.map((r) => ({
      automationId: r.automation_id,
      automationName: "probe",
      status: r.status,
      error: r.error,
      createdAt: r.created_at,
    })),
    since,
    new Date().toISOString(),
  );
  const runId = await recordRun({
    automationId: auto.id,
    workspaceId: auto.workspace_id,
    status: "finished",
    output: digest,
  });
  console.log(`recorded digest run ${runId} (headline: "${digest.headline}")`);

  const latest = (await getLatestDigest(auto.workspace_id)) as {
    kind?: string;
    headline?: string;
  } | null;
  const ok = latest?.kind === "automation_digest";
  console.log(
    `getLatestDigest(real ws) → ${ok ? `FOUND ✓ ("${latest?.headline}")` : "NOT FOUND ✗"}`,
  );

  // Clean up the probe row.
  await supabase.from("automation_run").delete().eq("id", runId);
  console.log("cleaned up probe run");
  console.log(`→ digest query round-trip : ${ok ? "PROVEN" : "FAILED"}`);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
