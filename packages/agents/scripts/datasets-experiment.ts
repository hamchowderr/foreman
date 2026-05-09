/**
 * Run an experiment against the foreman-baseline-v1 dataset.
 *
 * Sends each item's `input.request` through the foreman agent, captures the
 * trajectory, and scores it with:
 *   - trajectory-accuracy (code, no LLM cost): does the agent's tool sequence
 *     match expectedTrajectory.steps and avoid blacklistedTools?
 *
 * For a richer accuracy/quality score we'd add an LLM-judge scorer that
 * compares the agent's text output against groundTruth.expected_behavior.
 * That's deliberately omitted here so the smoke run is cheap — add it once
 * the trajectory baseline looks reasonable.
 *
 * Args:
 *   --limit N       Run on first N labeled items (default: 5)
 *   --full          Run on all labeled items (overrides --limit)
 *   --async         Use startExperimentAsync (returns id, doesn't block)
 *
 * Usage:
 *   npm run datasets:experiment              # 5 items, sync
 *   npm run datasets:experiment -- --limit 20
 *   npm run datasets:experiment -- --full --async
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");
const { foremanTrajectoryScorer } = await import(
  "../src/lib/scorers/foreman-trajectory"
);

const DATASET_NAME = "foreman-baseline-v1";

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = args.includes("--full")
    ? Infinity
    : limitIdx >= 0
      ? Number(args[limitIdx + 1])
      : 5;
  const isAsync = args.includes("--async");

  console.log("=== Foreman Datasets — Run Experiment ===");
  console.log(
    `Mode: ${isAsync ? "ASYNC" : "SYNC"} | limit=${Number.isFinite(limit) ? limit : "all"}\n`,
  );

  const { datasets } = await mastra.datasets.list({ perPage: 200 });
  const match = datasets.find((d) => d.name === DATASET_NAME);
  if (!match) {
    console.error(`Dataset "${DATASET_NAME}" not found.`);
    process.exit(1);
  }
  const dataset = await mastra.datasets.get({ id: match.id });

  const expName = `foreman-baseline-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

  console.log(`Experiment name: ${expName}`);
  console.log(`Dataset:         ${dataset.id}`);
  console.log(`Target:          agent foreman`);
  console.log(`Scorers:         [foreman-trajectory-accuracy]`);
  console.log();

  const startOpts = {
    name: expName,
    description: `Baseline trajectory eval against the v1 prompt rewrite. ${Number.isFinite(limit) ? `Limited to ${limit} items.` : "All items."}`,
    targetType: "agent" as const,
    targetId: "foreman",
    scorers: { agent: [foremanTrajectoryScorer] } as any,
    maxConcurrency: 3,
    itemTimeout: 120_000,
    maxRetries: 1,
    ...(Number.isFinite(limit) ? { limit } : {}),
  };

  if (isAsync) {
    const { experimentId, status } = await dataset.startExperimentAsync(
      startOpts as any,
    );
    console.log(`Started:   experimentId=${experimentId} status=${status}`);
    console.log(
      "Poll with: dataset.getExperiment({ experimentId }) until status='completed'.",
    );
    console.log(
      `View in Studio: http://localhost:4111/experiments  (or /datasets/${dataset.id} → Experiments tab)`,
    );
    process.exit(0);
  }

  console.log("Running synchronously — this will take a few minutes…\n");
  const summary = await dataset.startExperiment(startOpts as any);

  console.log("=== RESULTS ===");
  console.log(`Status:           ${summary.status}`);
  console.log(`Total items:      ${summary.totalItems}`);
  console.log(`Succeeded:        ${summary.succeededCount}`);
  console.log(`Failed:           ${summary.failedCount}`);
  console.log(`Skipped:          ${summary.skippedCount ?? 0}`);
  console.log(
    `Elapsed:          ${summary.completedAt instanceof Date ? Math.round((summary.completedAt.getTime() - summary.startedAt.getTime()) / 1000) : "?"}s`,
  );

  if (summary.results?.length) {
    const scores = summary.results
      .flatMap((r) => r.scores ?? [])
      .map((s) => s.score)
      .filter((s): s is number => typeof s === "number");
    if (scores.length) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      console.log(`Avg score:        ${avg.toFixed(3)} (across ${scores.length})`);
    }
  }

  console.log(
    `\nView in Studio: http://localhost:4111/datasets/${dataset.id} → Experiments tab`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});
