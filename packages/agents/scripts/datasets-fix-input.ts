/**
 * Fix existing items in foreman-baseline-v1: change input from an object
 * `{source, request, external_id}` to just the request string. Move
 * source/external_id into metadata so they don't get lost.
 *
 * Reason: dataset.startExperiment passes input directly to agent.generate(),
 * which only accepts string | string[] | CoreMessage[]. Object input fails
 * with "Message with role 'undefined' must have either a 'content' property
 * or a 'parts' property".
 *
 * Usage: npm run datasets:fix-input
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";

async function main() {
  console.log("=== Foreman Datasets — Fix Input Format ===\n");

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
  let alreadyFixed = 0;
  for (const item of items) {
    const input = item.input as
      | { request?: string; source?: string; external_id?: string }
      | string;

    if (typeof input === "string") {
      alreadyFixed++;
      continue;
    }

    if (!input?.request) {
      console.warn(`  skip ${item.id}: no request field`);
      continue;
    }

    const newMetadata = {
      ...((item.metadata as Record<string, unknown> | undefined) ?? {}),
      source: input.source,
      external_id: input.external_id,
    };

    await dataset.updateItem({
      itemId: item.id,
      input: input.request,
      metadata: newMetadata,
    });
    updated++;
  }

  console.log(`Updated:        ${updated}`);
  console.log(`Already string: ${alreadyFixed}\n`);
  console.log("=== DONE ===");
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
