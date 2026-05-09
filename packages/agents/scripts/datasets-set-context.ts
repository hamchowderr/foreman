/**
 * Set per-item requestContext on every dataset item with a synthetic threadId
 * and resourceId. Mastra's experiment runner doesn't auto-inject thread context,
 * but Foreman's agent requires it because ObservationalMemory has scope: 'thread'.
 *
 * Each item gets:
 *   requestContext: {
 *     threadId: `experiment-<item-id-prefix>`,
 *     resourceId: 'foreman-experiment',
 *   }
 *
 * Per-item threadId means each test runs in its own isolated thread — no
 * memory bleed between cases. resourceId is constant so all results group
 * under the same logical user in Studio.
 *
 * Usage: npm run datasets:set-context
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";
const RESOURCE_ID = "foreman-experiment";

async function main() {
  console.log("=== Foreman Datasets — Set requestContext ===\n");

  const { datasets } = await mastra.datasets.list({ perPage: 200 });
  const match = datasets.find((d) => d.name === DATASET_NAME);
  if (!match) {
    console.error(`Dataset "${DATASET_NAME}" not found.`);
    process.exit(1);
  }
  const dataset = await mastra.datasets.get({ id: match.id });

  const listed = await dataset.listItems({ page: 0, perPage: 200 });
  const items = Array.isArray(listed) ? listed : listed.items;

  let updated = 0;
  for (const item of items) {
    const threadId = `exp-${item.id.slice(0, 8)}`;
    await dataset.updateItem({
      itemId: item.id,
      requestContext: {
        threadId,
        resourceId: RESOURCE_ID,
      },
    });
    updated++;
  }

  console.log(`Updated: ${updated}\n`);
  console.log(`Each item now has its own threadId (exp-<id-prefix>) and shared resourceId="${RESOURCE_ID}".`);
  console.log("=== DONE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});
