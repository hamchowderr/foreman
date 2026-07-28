/**
 * Translate each item's `groundTruth.expected_behavior.expected_tools` and
 * `forbidden_tools` into the top-level `expectedTrajectory` field that
 * Mastra's createTrajectoryScorerCode reads from.
 *
 * Mastra's trajectory scorer expects:
 *   expectedTrajectory: {
 *     steps: [{ stepType: 'tool_call', name: 'find-unique-connection' }, ...],
 *     blacklistedTools: ['run-action[app=zapier-tables]'],
 *     ordering: 'relaxed' | 'strict' | 'unordered',
 *   }
 *
 * Our labels live inside groundTruth (richer, free-form). This script keeps
 * groundTruth as the canonical human-readable label and projects the
 * machine-comparable trajectory shape into expectedTrajectory.
 *
 * Usage: npm run datasets:set-trajectory
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";

interface ExpectedBehavior {
  expected_behavior: string;
  expected_tools: string[];
  forbidden_tools: string[];
}

interface GroundTruth {
  category_hint: string;
  expected_behavior: ExpectedBehavior | null;
}

async function main() {
  console.log("=== Foreman Datasets — Set expectedTrajectory ===\n");

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
  let skipped = 0;
  for (const item of items) {
    const gt = item.groundTruth as GroundTruth | undefined;
    if (!gt?.expected_behavior) {
      skipped++;
      continue;
    }

    const eb = gt.expected_behavior;
    const expectedTrajectory = {
      steps: eb.expected_tools.map((name) => ({
        stepType: "tool_call" as const,
        name,
      })),
      blacklistedTools: eb.forbidden_tools,
      // Relaxed ordering: tools must appear in expected order, but extra tools
      // in between are allowed. This matches Foreman's flow where the agent
      // may insert clarification turns or retry on transient errors.
      ordering: "relaxed" as const,
    };

    await dataset.updateItem({
      itemId: item.id,
      expectedTrajectory,
    });
    updated++;
  }

  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped} (no expected_behavior label yet)\n`);
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
