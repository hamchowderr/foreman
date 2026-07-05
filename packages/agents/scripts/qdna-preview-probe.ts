/**
 * foreman-qdna verification probe. Exercises the REAL preview-builder path
 * headlessly: build the agent, generate a component from a sample brief, and
 * check two things the qdna note left "pending live build":
 *   1. does Haiku actually invoke the shadcn `skill` tool at build time?
 *   2. does the generated component type-check (the "TS-error drop" signal)?
 *
 * Writes the output to the preview-template's generated.tsx and runs the same
 * typecheckPreview() the preview_app self-heal loop uses. Does NOT spawn Vite.
 *
 * Run:  infisical run --projectId e56e0da5-6460-4bab-bdd6-2fd12ac5447b --env dev \
 *         --recursive --silent -- npx tsx scripts/qdna-preview-probe.ts
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typecheckPreview } from "../src/lib/preview/serve";
import { createPreviewBuilderAgent } from "../src/mastra/agents/preview-builder";

const here = path.dirname(fileURLToPath(import.meta.url));
const GENERATED = path.join(here, "..", "preview-template", "src", "generated.tsx");

/** Same extraction the preview_app tool uses. */
function extractComponent(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```[a-zA-Z]*\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  const match = text.match(/^(import\s|export\s+default\b)/m);
  if (match && match.index !== undefined && match.index > 0) text = text.slice(match.index).trim();
  return text;
}

const BRIEF =
  "Build this:\n\nA SaaS sales dashboard. Three KPI cards (Monthly Revenue, New Customers, " +
  "Churn Rate) each with a trend badge; a monthly revenue bar chart; and a recent-orders table " +
  "(customer, plan, amount, status). Invent realistic, internally-consistent sample data.";

const toolCalls: string[] = [];

async function main() {
  const agent = createPreviewBuilderAgent();
  const res = await agent.generate(BRIEF, {
    // Capture every tool the builder calls during generation.
    onStepFinish: (step: unknown) => {
      const s = step as {
        toolCalls?: Array<{ toolName?: string; payload?: { toolName?: string } }>;
      };
      for (const tc of s?.toolCalls ?? [])
        toolCalls.push(tc.toolName ?? tc.payload?.toolName ?? "?");
    },
  });

  // Belt-and-suspenders: also read tool calls off the result if the callback shape differs.
  const r = res as unknown as {
    text?: string;
    toolCalls?: Array<{ toolName?: string }>;
    steps?: Array<{ toolCalls?: Array<{ toolName?: string }> }>;
  };
  if (toolCalls.length === 0) {
    for (const tc of r.toolCalls ?? []) toolCalls.push(tc.toolName ?? "?");
    for (const st of r.steps ?? [])
      for (const tc of st.toolCalls ?? []) toolCalls.push(tc.toolName ?? "?");
  }

  const tsx = extractComponent(r.text ?? "");
  await writeFile(GENERATED, tsx, "utf8");
  const check = await typecheckPreview();

  const skillInvoked = toolCalls.some((t) => t === "skill" || t.startsWith("skill"));
  console.log("─".repeat(60));
  console.log("QDNA PREVIEW PROBE");
  console.log("tool calls        :", toolCalls.length ? toolCalls.join(", ") : "(none captured)");
  console.log("skill tool invoked:", skillInvoked ? "YES ✓" : "NO ✗");
  console.log("tsx length        :", tsx.length, "chars");
  console.log("type-checks (tsc) :", check.ok ? "PASS ✓ (first try)" : "FAIL ✗");
  if (!check.ok) console.log("errors:\n" + check.errors);
  console.log("─".repeat(60));
  process.exit(0);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
