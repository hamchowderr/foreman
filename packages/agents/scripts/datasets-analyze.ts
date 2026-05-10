/**
 * Analyze the most recent experiment: per-scorer averages, score distribution,
 * worst-performing items, and category breakdowns.
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";

async function main() {
  const { datasets } = await mastra.datasets.list({ perPage: 200 });
  const match = datasets.find((d) => d.name === DATASET_NAME);
  if (!match) {
    console.error(`Dataset "${DATASET_NAME}" not found.`);
    process.exit(1);
  }
  const dataset = await mastra.datasets.get({ id: match.id });

  // Get most recent experiment
  const { experiments } = await dataset.listExperiments({ perPage: 50 });
  const sorted = experiments.sort(
    (a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime(),
  );
  const latest = sorted[0];
  console.log(`Latest experiment: ${latest.name}  id=${latest.id}`);
  console.log(`Created: ${latest.createdAt}  Status: ${latest.status}\n`);

  // Pull all results (paginate). NOTE: server caps per-page response below the
  // requested `perPage` and reports `hasMore: false` even when total > returned.
  // We page until we either hit `total` items or run out of pages.
  // Storage uses 0-indexed pages. Some adapters cap perPage; use small batches.
  const allResults: any[] = [];
  let page = 0;
  let total = Infinity;
  const PER_PAGE = 25;
  while (allResults.length < total) {
    const out = await dataset.listExperimentResults({
      experimentId: latest.id,
      page,
      perPage: PER_PAGE,
    });
    const items = (out as any).results ?? [];
    const pagination = (out as any).pagination;
    if (typeof pagination?.total === "number") total = pagination.total;
    console.log(
      `  page ${page}: got ${items.length} items (cumulative ${allResults.length + items.length}/${total})`,
    );
    if (items.length === 0) break;
    allResults.push(...items);
    page++;
    if (page > 20) break;
  }

  if (!allResults.length) {
    console.log("No results.");
    process.exit(0);
  }
  console.log(`Fetched ${allResults.length} results across ${page} page(s).\n`);

  // Show raw shape of the first result so we can locate scores
  console.log("Sample result keys:", Object.keys(allResults[0]).join(", "));
  for (const k of Object.keys(allResults[0])) {
    const v = (allResults[0] as any)[k];
    if (k === "input" || k === "output" || k === "groundTruth") continue;
    console.log(
      `  ${k}: ${typeof v === "object" ? JSON.stringify(v)?.slice(0, 200) : String(v)?.slice(0, 100)}`,
    );
  }
  console.log();

  // Scores live in the observability store keyed by experimentId. Pull all
  // scores for this experiment, then group by traceId so we can attach to
  // each result.
  const storage = (mastra as any).getStorage();
  const scoresStore = await storage.getStore("scores");
  if (!scoresStore) {
    console.error("scores domain not available on storage.");
    process.exit(1);
  }

  // Scores are keyed by runId=experimentId. Pull all scores for this experiment.
  const allScores: any[] = [];
  let scorePage = 0;
  while (true) {
    const out = await (scoresStore as any).listScoresByRunId({
      runId: latest.id,
      pagination: { page: scorePage, perPage: 200 },
    });
    const items = out?.scores ?? [];
    allScores.push(...items);
    if (!out?.pagination?.hasMore) break;
    scorePage++;
    if (scorePage > 20) break;
  }
  console.log(`Pulled ${allScores.length} scores for runId=${latest.id}.`);

  const scoresByTrace = new Map<string, any[]>();
  for (const s of allScores) {
    const tid = s.traceId;
    if (!tid) continue;
    if (!scoresByTrace.has(tid)) scoresByTrace.set(tid, []);
    scoresByTrace.get(tid)!.push(s);
  }

  for (const r of allResults) {
    const tid = r.traceId;
    const list = (tid && scoresByTrace.get(tid)) ?? [];
    r.scores = list.map((s: any) => ({
      scorerId: s.scorerId,
      score: s.score,
      reason: s.reason,
    }));
  }

  const exp = { results: allResults };

  // Per-scorer aggregation
  const byScorer = new Map<string, number[]>();
  const perItem: Array<{
    input: string;
    category: string | null;
    trajectoryScore: number | null;
    trajectoryReason: string | null;
    judgeScore: number | null;
    judgeReason: string | null;
  }> = [];

  for (const r of exp.results) {
    const inputStr = typeof r.input === "string" ? r.input : JSON.stringify(r.input);
    const gt = (r as any).groundTruth as { category_hint?: string } | undefined;
    const category = gt?.category_hint ?? null;

    let trajectoryScore: number | null = null;
    let trajectoryReason: string | null = null;
    let judgeScore: number | null = null;
    let judgeReason: string | null = null;

    for (const s of r.scores ?? []) {
      const id = (s as any).scorerId as string;
      const score = (s as any).score as number | undefined;
      const reason = (s as any).reason as string | undefined;
      if (typeof score === "number") {
        if (!byScorer.has(id)) byScorer.set(id, []);
        byScorer.get(id)!.push(score);
      }
      if (id === "foreman-trajectory-accuracy") {
        trajectoryScore = score ?? null;
        trajectoryReason = reason ?? null;
      } else if (id === "foreman-llm-judge") {
        judgeScore = score ?? null;
        judgeReason = reason ?? null;
      }
    }

    perItem.push({
      input: inputStr,
      category,
      trajectoryScore,
      trajectoryReason,
      judgeScore,
      judgeReason,
    });
  }

  console.log("=== Per-Scorer Averages ===");
  for (const [id, scores] of byScorer) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const ones = scores.filter((s) => s === 1).length;
    const zeros = scores.filter((s) => s === 0).length;
    console.log(
      `${id.padEnd(35)} avg=${avg.toFixed(3)}  n=${scores.length}  perfect=${ones}  zeros=${zeros}`,
    );
  }

  // Category breakdown
  console.log("\n=== Per-Category Averages ===");
  const byCategory = new Map<string, { traj: number[]; judge: number[] }>();
  for (const item of perItem) {
    const key = item.category ?? "(none)";
    if (!byCategory.has(key)) byCategory.set(key, { traj: [], judge: [] });
    const bucket = byCategory.get(key)!;
    if (item.trajectoryScore !== null) bucket.traj.push(item.trajectoryScore);
    if (item.judgeScore !== null) bucket.judge.push(item.judgeScore);
  }
  console.log(
    "category".padEnd(28) + "n".padStart(4) + "traj_avg".padStart(12) + "judge_avg".padStart(12),
  );
  for (const [cat, b] of [...byCategory.entries()].sort()) {
    const tAvg = b.traj.length ? b.traj.reduce((a, x) => a + x, 0) / b.traj.length : NaN;
    const jAvg = b.judge.length ? b.judge.reduce((a, x) => a + x, 0) / b.judge.length : NaN;
    console.log(
      cat.padEnd(28) +
        String(b.traj.length).padStart(4) +
        (Number.isFinite(tAvg) ? tAvg.toFixed(3) : "  -  ").padStart(12) +
        (Number.isFinite(jAvg) ? jAvg.toFixed(3) : "  -  ").padStart(12),
    );
  }

  // Worst 10 items by judge score
  console.log("\n=== Worst 10 Items (by LLM Judge) ===");
  const sortedItems = [...perItem]
    .filter((i) => i.judgeScore !== null)
    .sort((a, b) => (a.judgeScore as number) - (b.judgeScore as number))
    .slice(0, 10);
  for (const item of sortedItems) {
    console.log(
      `\n[${item.category ?? "?"}] judge=${item.judgeScore}  traj=${item.trajectoryScore}`,
    );
    console.log(`  "${item.input.slice(0, 100)}${item.input.length > 100 ? "…" : ""}"`);
    if (item.judgeReason) {
      console.log(`  judge: ${item.judgeReason.slice(0, 250)}`);
    }
  }

  // Trajectory failures (score=0 but expected non-empty)
  console.log("\n=== Trajectory Failures (score=0) ===");
  const trajFails = perItem.filter((i) => i.trajectoryScore === 0);
  console.log(`Count: ${trajFails.length}`);
  for (const item of trajFails.slice(0, 8)) {
    console.log(`\n[${item.category ?? "?"}] judge=${item.judgeScore}`);
    console.log(`  "${item.input.slice(0, 100)}${item.input.length > 100 ? "…" : ""}"`);
    if (item.trajectoryReason) {
      console.log(`  traj: ${item.trajectoryReason.slice(0, 300)}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
