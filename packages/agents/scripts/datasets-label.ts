/**
 * Generate `expected_behavior` ground-truth labels for items in the
 * foreman-baseline-v1 dataset.
 *
 * Strategy: deterministic category-based templates. Each item's category_hint
 * maps to a known Foreman flow (per lib/prompt-template.ts), so the label
 * captures three machine-comparable fields:
 *
 *   expected_behavior    — short description for an LLM judge to score against
 *   expected_tools       — ordered list of tool names (for trajectory scoring)
 *   forbidden_tools      — tools that must NOT appear in a correct trace
 *
 * Args:
 *   --limit N           Only label first N matching cases (default: all)
 *   --representative    Cherry-pick 1 case per category (10 cases total)
 *   --dry-run           Print labels but don't update the dataset
 *
 * Usage:
 *   npm run datasets:label -- --representative --dry-run
 *   npm run datasets:label -- --representative
 *   npm run datasets:label
 */
process.env.DUCKDB_PATH = process.env.DUCKDB_PATH ?? "./data/smoke.duckdb";

const { mastra } = await import("../src/mastra");

const DATASET_NAME = "foreman-baseline-v1";

interface ExpectedBehavior {
  expected_behavior: string;
  expected_tools: string[];
  forbidden_tools: string[];
}

interface RawInput {
  request: string;
  source: string;
  external_id: string;
}

interface RawGroundTruth {
  category_hint: string;
  expected_behavior: ExpectedBehavior | null;
}

const TEMPLATES: Record<string, (req: string) => ExpectedBehavior> = {
  "one-shot-action": (_req) => ({
    expected_behavior: `Single-app action. Foreman should run the 5-phase action_flow: find-unique-connection → list-actions(actionType: "write" or "search") → get-action-input-fields-schema (first pass) → list-action-input-field-choices for selectors → get-action-input-fields-schema (second pass) → confirm using the structured template ("I'll run **<action>** on **<app>** using the **<account>** connection with: …Confirm?") → run-action on user confirmation. Should NOT proceed with the write before confirming. Read/search actions skip confirmation.`,
    expected_tools: [
      "find-unique-connection",
      "list-actions",
      "get-action-input-fields-schema",
      "list-action-input-field-choices",
      "get-action-input-fields-schema",
      "run-action",
    ],
    forbidden_tools: ["run-action[app=zapier-tables]", "create-table"],
  }),

  "save-as-workflow": (_req) => ({
    expected_behavior: `Multi-step recurring shape (no explicit time/event trigger). Foreman should walk through the multi-step flow once via run-action. Saving/replaying a conversation as a reusable workflow is NOT available yet — Foreman runs the steps now and, if the user wants to repeat them, says plainly that saved/reusable workflows aren't available yet (never redirect to zapier.com).`,
    expected_tools: [
      "find-unique-connection",
      "list-actions",
      "get-action-input-fields-schema",
      "list-action-input-field-choices",
      "get-action-input-fields-schema",
      "run-action",
    ],
    forbidden_tools: ["run-action[app=zapier-tables]"],
  }),

  "scheduled-workflow": (_req) => ({
    expected_behavior: `Time-based recurring request (e.g., "every Monday 9am"). Foreman should run the action shape once now via run-action, then tell the user plainly that scheduled/recurring runs aren't available yet — it must NOT claim to have scheduled anything and must NOT redirect to zapier.com. It may ask one clarifying question about timing, but cannot actually schedule.`,
    expected_tools: [
      "find-unique-connection",
      "list-actions",
      "get-action-input-fields-schema",
      "list-action-input-field-choices",
      "get-action-input-fields-schema",
      "run-action",
    ],
    forbidden_tools: ["run-action[app=zapier-tables]"],
  }),

  "channel-triggered-workflow": (_req) => ({
    expected_behavior: `Event-triggered recurring request (e.g., "when X happens, do Y"). Foreman should run the action shape once now via run-action, then tell the user plainly that event-triggered automation isn't available yet — it must NOT claim to have set up a trigger and must NOT redirect to zapier.com.`,
    expected_tools: [
      "find-unique-connection",
      "list-actions",
      "get-action-input-fields-schema",
      "list-action-input-field-choices",
      "get-action-input-fields-schema",
      "run-action",
    ],
    forbidden_tools: ["run-action[app=zapier-tables]"],
  }),

  "tables-crud": (_req) => ({
    expected_behavior: `Zapier Tables operation. Foreman MUST use the Tables Flow tools, NOT run-action. Typical sequence: create-table → create-table-fields → create-table-records (or list/get/update/delete variants). Field types include string, number, bool, date, datetime, enum.`,
    expected_tools: ["create-table", "create-table-fields", "create-table-records"],
    forbidden_tools: ["run-action[app=zapier-tables]", "run-action"],
  }),

  "data-question": (_req) => ({
    expected_behavior: `Read-only query against a connected app. Foreman should: find-unique-connection → list-actions(actionType: "search" or "read") → schema discovery if needed → run-action immediately (no confirmation needed for reads, per Phase 4). Returns results to user.`,
    expected_tools: [
      "find-unique-connection",
      "list-actions",
      "get-action-input-fields-schema",
      "run-action",
    ],
    forbidden_tools: [],
  }),

  "connect-app": (_req) => ({
    expected_behavior: `App-not-connected case. Foreman should: find-unique-connection (returns nothing) → if ambiguous which service, ask one clarifying question; otherwise connect_zapier({appSlug}) → share the raw URL → STOP and wait for user to confirm completion. Should NOT proceed to action execution until user reports back.`,
    expected_tools: ["find-unique-connection", "connect_zapier"],
    forbidden_tools: ["run-action"],
  }),

  "clarification-needed": (_req) => ({
    expected_behavior: `Ambiguous request. Foreman should NOT call any tools. Should ask exactly ONE clear clarifying question (e.g., "did you want to do X right now, or set it up to happen automatically?"). Subsequent turns proceed based on the user's answer.`,
    expected_tools: [],
    forbidden_tools: ["run-action", "list-actions", "find-unique-connection"],
  }),

  "support-question": (_req) => ({
    expected_behavior: `Foreman platform support / troubleshooting / billing question — not an automation request. Best behavior: explain Foreman's scope briefly and direct the user to the appropriate support channel or settings page. Should NOT call discovery/action tools.`,
    expected_tools: [],
    forbidden_tools: ["run-action", "list-actions"],
  }),

  "out-of-scope": (_req) => ({
    expected_behavior: `Not an automation request (e.g., reporting phishing, off-topic). Foreman should respond with text only — no tool calls — and either redirect to the appropriate channel/resource or politely decline.`,
    expected_tools: [],
    forbidden_tools: ["run-action", "list-actions", "connect_zapier"],
  }),

  "platform-meta": (_req) => ({
    expected_behavior: `Conceptual or platform-meta question (e.g., "agents vs workflows?"). Foreman should explain the concept in text. No tool calls expected.`,
    expected_tools: [],
    forbidden_tools: ["run-action"],
  }),
};

const REPRESENTATIVE_IDS = [
  "case-006", // clarification-needed
  "case-026", // support-question
  "case-071", // one-shot-action
  "case-073", // data-question
  "case-074", // connect-app
  "case-075", // tables-crud
  "case-077", // out-of-scope
  "case-001", // scheduled-workflow
  "case-004", // channel-triggered-workflow
  "case-016", // save-as-workflow
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const representative = args.includes("--representative");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  console.log("=== Foreman Datasets — Label Cases ===");
  console.log(
    `Mode: ${dryRun ? "DRY-RUN" : "LIVE"}${representative ? " | representative-only" : ""}${Number.isFinite(limit) ? ` | limit=${limit}` : ""}\n`,
  );

  const { datasets } = await mastra.datasets.list({ perPage: 200 });
  const match = datasets.find((d) => d.name === DATASET_NAME);
  if (!match) {
    console.error(`Dataset "${DATASET_NAME}" not found. Run datasets:load-raw first.`);
    process.exit(1);
  }
  const dataset = await mastra.datasets.get({ id: match.id });
  console.log(`Dataset: ${dataset.id}\n`);

  const listed = await dataset.listItems({ page: 0, perPage: 200 });
  const items = Array.isArray(listed) ? listed : listed.items;

  let candidates = items.filter((it) => {
    const gt = it.groundTruth as RawGroundTruth | undefined;
    return gt && gt.expected_behavior == null && TEMPLATES[gt.category_hint];
  });

  if (representative) {
    candidates = candidates.filter((it) =>
      REPRESENTATIVE_IDS.includes((it.input as RawInput).external_id),
    );
  }

  candidates = candidates.slice(0, Number.isFinite(limit) ? limit : candidates.length);

  console.log(`Will label ${candidates.length} case(s):\n`);

  let updated = 0;
  for (const item of candidates) {
    const input = item.input as RawInput;
    const gt = item.groundTruth as RawGroundTruth;
    const tmpl = TEMPLATES[gt.category_hint];
    const label = tmpl(input.request);

    console.log(`[${input.external_id}] (${gt.category_hint})`);
    console.log(
      `  REQUEST: ${input.request.slice(0, 100)}${input.request.length > 100 ? "…" : ""}`,
    );
    console.log(
      `  TOOLS:   ${label.expected_tools.length === 0 ? "(none)" : label.expected_tools.join(" → ")}`,
    );
    console.log(
      `  FORBID:  ${label.forbidden_tools.length === 0 ? "(none)" : label.forbidden_tools.join(", ")}`,
    );
    console.log(`  BEHAVIOR: ${label.expected_behavior.slice(0, 160)}…`);
    console.log();

    if (!dryRun) {
      await dataset.updateItem({
        itemId: item.id,
        groundTruth: {
          category_hint: gt.category_hint,
          expected_behavior: label,
        },
      });
      updated++;
    }
  }

  console.log("=== DONE ===");
  console.log(
    `${dryRun ? "Would have updated" : "Updated"}: ${dryRun ? candidates.length : updated} item(s)`,
  );
  if (!dryRun) {
    console.log(`View in Studio: http://localhost:4111  (Datasets tab → ${DATASET_NAME} → Items)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== FAILED ===");
  console.error(err);
  process.exit(1);
});
