/**
 * Load the raw automation requests from datasets/foreman-cases-raw.json into
 * a Mastra dataset. Each item has the user request as `input` and the
 * category hint as `groundTruth.category` — to be filled in with full
 * expected behavior in a follow-up labeling pass.
 *
 * Idempotent on dataset name: if a dataset with the same name exists, it
 * will be reused; existing items remain untouched and only new IDs are added.
 *
 * Usage: npm run datasets:load-raw
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";
const DATASET_DESCRIPTION =
  "Baseline regression cases for Foreman agent quality. Sourced from Zapier community 'How Do I' forum, official Zapier templates, and synthetic edge cases. Each item is the raw user request — labeling pass to follow.";

interface RawCase {
  id: string;
  source: string;
  raw_input: string;
  category_hint: string;
}

interface RawFile {
  generated_at: string;
  cases: RawCase[];
}

async function main() {
  console.log("=== Foreman Datasets — Load Raw Cases ===\n");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, "..", "datasets", "foreman-cases-raw.json");
  console.log(`[1/4] Reading ${path.relative(process.cwd(), file)}…`);
  const raw: RawFile = JSON.parse(await readFile(file, "utf8"));
  console.log(`      ok  ${raw.cases.length} cases loaded from disk\n`);

  console.log(`[2/4] Resolving dataset "${DATASET_NAME}"…`);
  const { datasets: existing } = await mastra.datasets.list({ perPage: 200 });
  const match = existing.find((d) => d.name === DATASET_NAME);
  const dataset = match
    ? await mastra.datasets.get({ id: match.id })
    : await mastra.datasets.create({
        name: DATASET_NAME,
        description: DATASET_DESCRIPTION,
      });
  console.log(`      ok  ${match ? "reused" : "created"} id=${dataset.id}\n`);

  console.log("[3/4] Adding items in bulk…");
  await dataset.addItems({
    items: raw.cases.map((c) => ({
      input: {
        request: c.raw_input,
        source: c.source,
        external_id: c.id,
      },
      groundTruth: {
        category_hint: c.category_hint,
        expected_behavior: null,
      },
      metadata: {
        external_id: c.id,
        source: c.source,
      },
    })),
  });
  console.log(`      ok  ${raw.cases.length} items added\n`);

  console.log("[4/4] Verifying…");
  const listed = await dataset.listItems({ page: 0, perPage: 5 });
  const total = Array.isArray(listed) ? listed.length : listed.pagination.total;
  console.log(`      ok  total items in dataset: ${total}\n`);

  console.log("=== DONE ===");
  console.log(`Dataset:  ${dataset.id}`);
  console.log(`Name:     ${DATASET_NAME}`);
  console.log("View in Studio: http://localhost:4111  (Datasets tab)");
  console.log("\nNext step: label expected_behavior for each item, then start an experiment.");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});
