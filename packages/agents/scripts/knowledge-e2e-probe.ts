/**
 * foreman-aqjx E2E: prove per-workspace knowledge search works against REAL
 * Postgres and that indexes are ISOLATED per tenant (the whole security model).
 * Local DB only — run with .env.local, NOT under `infisical run` (which injects
 * cloud DB creds that override the local ones).
 *
 *   npx tsx --env-file=.env.local scripts/knowledge-e2e-probe.ts
 *
 * Indexes a distinct doc into two tenant indexes, then searches each with a
 * freshly-constructed (non-init) Workspace: tenant A must find its own doc, and
 * tenant B must NOT see A's doc (different physical index = the tenant boundary).
 */
import { getKnowledgeVector, knowledgeIndexName } from "../src/lib/knowledge/vector";
import { buildTenantKnowledgeWorkspace, indexSharedDoc } from "../src/mastra/agents/workspace";

function mentionsPricing(
  hits: Array<{ content?: string; metadata?: Record<string, unknown> }>,
): boolean {
  return hits.some(
    (h) => (h.content ?? "").includes("Pro plan") || h.metadata?.path === "documents/pricing.md",
  );
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing (need .env.local)");
  const stamp = Math.floor(Number(process.env.PROBE_STAMP) || 1);
  const tenantA = `probe-a-${stamp}`;
  const tenantB = `probe-b-${stamp}`;

  // Distinct topics so we can tell which index a hit came from.
  await indexSharedDoc({
    tenantKey: tenantA,
    path: "documents/pricing.md",
    content:
      "Acme pricing: the Pro plan is $49 per seat per month, with an annual billing discount.",
    title: "Pricing",
  });
  await indexSharedDoc({
    tenantKey: tenantB,
    path: "documents/onboarding.md",
    content: "New hire onboarding: set up the laptop, VPN, and building badge on day one.",
    title: "Onboarding",
  });

  const query = "how much does the pro plan cost";
  const aHits = await buildTenantKnowledgeWorkspace(tenantA).search(query, {
    mode: "vector",
    topK: 5,
  });
  const bHits = await buildTenantKnowledgeWorkspace(tenantB).search(query, {
    mode: "vector",
    topK: 5,
  });

  const aFound = aHits.length > 0 && mentionsPricing(aHits);
  const bIsolated = !mentionsPricing(bHits);

  console.log("\n=== VERDICT ===");
  console.log(
    `tenant A finds its own pricing doc : ${aFound ? "YES" : "NO"} (${aHits.length} hits)`,
  );
  console.log(
    `tenant B isolated from A's doc     : ${bIsolated ? "YES" : "NO"} (${bHits.length} hits)`,
  );
  const ok = aFound && bIsolated;
  console.log(
    `→ per-workspace knowledge search   : ${ok ? "PROVEN (index + non-init search + isolation)" : "NOT PROVEN"}`,
  );

  // Cleanup: drop both probe indexes.
  const vector = getKnowledgeVector();
  for (const t of [tenantA, tenantB]) {
    await vector.deleteIndex({ indexName: knowledgeIndexName(t) }).catch(() => {});
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
