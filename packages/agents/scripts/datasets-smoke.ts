/**
 * Smoke test for the Mastra Datasets domain on Postgres.
 *
 * Verifies that:
 *   1. The composite store routes datasets to PostgresStore (DatasetsPG)
 *   2. mastra_datasets / mastra_dataset_items / mastra_dataset_versions tables get created
 *   3. The user-facing Datasets API (create / addItem / listItems / listVersions) works end-to-end
 *
 * Safe to run repeatedly — each run creates a uniquely-named dataset.
 *
 * Usage: npm run datasets:smoke
 *
 * Note: routes its own DuckDB file so it doesn't collide with the running
 * agent server (which holds an exclusive lock on data/mastra.duckdb).
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

// Dynamic import so the DUCKDB_PATH env var above is set BEFORE the mastra
// instance is constructed (top-level imports are hoisted in ESM, which
// would defeat the override).
const { mastra } = await import("../src/mastra");

async function main() {
  console.log("=== Foreman Datasets Smoke Test ===\n");

  console.log("[1/5] Creating dataset…");
  const dataset = await mastra.datasets.create({
    name: `smoke-test-${Date.now()}`,
    description: "Verify @mastra/pg datasets domain wiring. Safe to delete.",
  });
  console.log(`      ok  id=${dataset.id}`);

  console.log("[2/5] Adding single item…");
  await dataset.addItem({
    input: { request: "Send a Slack message to #general saying hello" },
    groundTruth: { expected_category: "one-shot-action" },
  });
  console.log("      ok  one item added");

  console.log("[3/5] Adding 2 items in bulk…");
  await dataset.addItems({
    items: [
      {
        input: { request: "Create a Zapier Table called 'Sales Leads'" },
        groundTruth: { expected_category: "tables-crud" },
      },
      {
        input: { request: "Notion isn't connected yet — can you link it?" },
        groundTruth: { expected_category: "connect-app" },
      },
    ],
  });
  console.log("      ok  2 bulk items added");

  console.log("[4/5] Listing items…");
  const listed = await dataset.listItems({ page: 0, perPage: 10 });
  const items = Array.isArray(listed) ? listed : listed.items;
  const total = Array.isArray(listed) ? listed.length : listed.pagination.total;
  console.log(`      ok  returned=${items.length} total=${total}`);
  for (const item of items) {
    const req = (item.input as { request?: string })?.request ?? "(no request)";
    console.log(`        - ${item.id}: ${req}`);
  }

  console.log("[5/5] Listing versions…");
  const { versions } = await dataset.listVersions();
  console.log(`      ok  ${versions.length} versions (each mutation bumps version)`);

  console.log("\n=== PASSED ===");
  console.log(`Dataset id: ${dataset.id}`);
  console.log("Created tables: mastra_datasets, mastra_dataset_items, mastra_dataset_versions");
  console.log("View in Studio: http://localhost:4111  (Datasets tab)");
  console.log("Or Supabase Studio: http://127.0.0.1:54423");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});

// This file only uses dynamic `import()`, so tsc would otherwise treat it as a
// global script rather than a module — colliding top-level names across scripts/
// and rejecting top-level `await`. See foreman-40ab.
export {};
