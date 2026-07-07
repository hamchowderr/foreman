/**
 * Run an experiment against a temporary 2-item dataset to validate the
 * pipeline before spending real tokens on the full 80.
 *
 * Creates a fresh dataset with 2 hand-picked cases (one ambiguous → no tools,
 * one one-shot-action → full flow), runs the trajectory scorer, prints the
 * results, then DELETES the dataset to keep things tidy.
 *
 * Usage: npm run datasets:mini-experiment
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");
const { foremanTrajectoryScorer } = await import("../src/lib/scorers/foreman-trajectory");
const { foremanLLMJudgeScorer } = await import("../src/lib/scorers/foreman-llm-judge");

const TEST_CASES = [
  {
    request: "Use Zapier to emoji react to Slack messages",
    groundTruth: {
      category_hint: "clarification-needed",
      expected_behavior: {
        expected_tools: [], // ambiguous → no tools expected
        forbidden_tools: ["run-action", "list-actions", "find-unique-connection"],
        expected_behavior:
          "Ambiguous request — Foreman should ask one clarifying question, no tool calls.",
      },
    },
    requestContext: {
      threadId: "exp-mini-ambiguous",
      resourceId: "foreman-experiment",
    },
  },
  {
    request: "Send 'standup in 5' to #general on Slack",
    groundTruth: {
      category_hint: "one-shot-action",
      expected_behavior: {
        expected_tools: [
          "find-unique-connection",
          "list-actions",
          "get-action-input-fields-schema",
          "list-action-input-field-choices",
          "get-action-input-fields-schema",
        ],
        forbidden_tools: ["run-action[app=zapier-tables]"],
        expected_behavior:
          "Single-app Slack write. Should walk the 5-phase action_flow and emit a structured confirmation.",
      },
    },
    requestContext: {
      threadId: "exp-mini-slack",
      resourceId: "foreman-experiment",
    },
  },
];

async function main() {
  console.log("=== Foreman Datasets — Mini Experiment ===\n");

  const tag = `mini-${Date.now()}`;
  console.log(`[1/4] Creating temporary dataset "${tag}"…`);
  const dataset = await mastra.datasets.create({
    name: tag,
    description: "Temporary 2-item mini dataset for pipeline validation. Auto-deleted.",
  });
  console.log(`      ok  id=${dataset.id}\n`);

  console.log(`[2/4] Adding ${TEST_CASES.length} items…`);
  for (const tc of TEST_CASES) {
    // addItem accepts input/groundTruth/metadata. requestContext is not part
    // of the addItem signature; it needs a second updateItem call to persist.
    const created = await dataset.addItem({
      input: tc.request,
      groundTruth: tc.groundTruth,
    });
    await dataset.updateItem({
      itemId: created.id,
      requestContext: tc.requestContext,
    });
  }
  console.log(`      ok\n`);

  console.log("[3/4] Running experiment (sync, 2 items)…");

  // Custom scorer reads MastraDBMessage parts directly (modern shape) so it
  // works with the actual agent output. Bucketed as `agent` because that's
  // the scorer's type — the runner passes raw output, no pre-extraction.
  const summary = await dataset.startExperiment({
    name: `mini-validate-${Date.now()}`,
    targetType: "agent" as const,
    targetId: "foreman",
    scorers: { agent: [foremanTrajectoryScorer, foremanLLMJudgeScorer] } as any,
    maxConcurrency: 1,
    itemTimeout: 180_000,
    maxRetries: 0,
  });

  console.log(
    `      status=${summary.status} succ=${summary.succeededCount}/${summary.totalItems} fail=${summary.failedCount}\n`,
  );

  console.log("[4/4] Per-item results:");
  for (const r of summary.results ?? []) {
    const inputStr = typeof r.input === "string" ? r.input : JSON.stringify(r.input);
    console.log(`  - "${inputStr.slice(0, 60)}${inputStr.length > 60 ? "…" : ""}"`);
    if (r.error) {
      console.log(`    ERROR: ${(r.error.message ?? "?").slice(0, 200)}`);
      continue;
    }
    console.log(`    scores raw: ${JSON.stringify(r.scores ?? null, null, 2).slice(0, 1500)}`);
  }

  console.log("\nLeaving mini dataset in place for inspection. Delete via Studio if you want.");
  console.log(`Dataset id: ${dataset.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});
