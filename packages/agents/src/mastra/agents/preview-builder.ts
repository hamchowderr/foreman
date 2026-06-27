import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "@mastra/core/agent";
import { LocalSkillSource, Workspace } from "@mastra/core/workspace";
import { MODELS } from "../../lib/providers";

/**
 * Preview Builder — a cheap Haiku agent that turns a short brief (+ optional
 * data) into a single React component built from the project's REAL shadcn/ui
 * components, for the `preview_app` tool (foreman-8nyg).
 *
 * Why a separate agent: making the primary Foreman agent (Sonnet 4.6) emit a
 * full component as a tool argument burns thousands of expensive output tokens
 * on every preview. Sonnet orchestrates (fetch data, decide what to build) and
 * hands a concise brief here; Haiku writes the verbose TSX at ~1/15th the cost.
 *
 * shadcn knowledge is a Mastra Agent Skill (foreman-qdna), NOT a hard-coded
 * prompt: a real `skills/shadcn/SKILL.md` is attached via the workspace below,
 * so Mastra injects its metadata into the system message and exposes the
 * `skill` tool. The builder loads the authoritative shadcn authoring rules
 * (import map, chart/table/form contracts, type-error pitfalls) at build time —
 * that's what keeps the generated component compiling on the first try.
 *
 * Output is a single `.tsx` file written into the warm Vite + React + Tailwind +
 * shadcn template (packages/agents/preview-template/src/generated.tsx); Vite HMR
 * renders it live.
 */

/**
 * Locate the directory that CONTAINS `skills/shadcn/SKILL.md` — the basePath for
 * the skills source. Robust whether this module runs from source (`mastra dev`
 * bundles it to a different depth) or built output, by walking up from both the
 * module dir and process.cwd() (mirrors serve.ts's resolveTemplateDir).
 */
function resolveSkillsBase(): string {
  const fromEnv = process.env.FOREMAN_SKILLS_DIR;
  if (fromEnv && existsSync(path.join(fromEnv, "shadcn", "SKILL.md"))) {
    return path.dirname(fromEnv);
  }
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 12; i++) {
      for (const candidate of [dir, path.join(dir, "packages", "agents")]) {
        if (existsSync(path.join(candidate, "skills", "shadcn", "SKILL.md"))) {
          return candidate;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // mastra dev runs from packages/agents, where ./skills resolves correctly.
  return process.cwd();
}

/**
 * Skills-only workspace (no filesystem/sandbox, so the builder gets ONLY the
 * read-only skill tools — `skill`, `skill_search`, `skill_read` — not the
 * workspace file tools). Mastra's SkillsProcessor injects the shadcn skill's
 * name + description into the system message; the builder calls `skill` to pull
 * the full instructions on demand.
 */
export const previewBuilderWorkspace = new Workspace({
  id: "preview-builder-skills",
  name: "Preview Builder Skills",
  skills: ["skills"],
  skillSource: new LocalSkillSource({ basePath: resolveSkillsBase() }),
  // Hot-reload SKILL.md edits in dev without a full re-scan.
  checkSkillFileMtime: true,
});

const PREVIEW_BUILDER_PROMPT = `You write ONE React component file (TSX) and NOTHING else. It is rendered inside a real Vite + React + Tailwind v4 + shadcn/ui app, so you use the ACTUAL shadcn components — not hand-written HTML/CSS.

BEFORE WRITING ANY CODE: call the \`skill\` tool with { "name": "shadcn" } to load the authoritative authoring rules — the exact import map, the ChartContainer/ChartConfig and DataTable/ColumnDef contracts, the react-hook-form+zod form pattern, and the specific type-error pitfalls. Follow those rules exactly; they are what make the component compile on the first try. Do this on every build (and again before any self-heal fix if it's no longer in context).

OUTPUT RULES
- Output ONLY the raw contents of a .tsx file. No markdown, no triple-backtick fences, no commentary before or after the code.
- Provide exactly one component as the DEFAULT export, taking NO props: \`export default function Dashboard() { ... }\`.
- Import shadcn components from "@/components/ui/<name>" using their real named exports. The full registry is available:
    accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, data-table, dialog, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, menubar, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip
  You may also import directly: react, recharts, @tanstack/react-table (type ColumnDef), react-hook-form, @hookform/resolvers/zod, zod, date-fns, sonner, lucide-react, and cn from "@/lib/utils".
- Never import a name that isn't a real export, never import a CSS file, never write a <style> tag, raw <script>, runtime fetch, or any package not listed above. (The skill's import map has the exact export names per component — use it.)

NON-NEGOTIABLE INVARIANTS (the skill explains each; never violate them)
- Every chart wraps in <ChartContainer config={...} className="h-[280px] w-full"> with an EXPLICIT height, and you do NOT add your own <ResponsiveContainer>. ChartConfig keys match each series' dataKey; colors via var(--color-KEY).
- For tabular data use <DataTable columns={columns} data={rows} />; define a Row type so ColumnDef<Row> accessorKeys are type-checked.
- Every chart/table has realistic, internally-consistent inline data — NEVER an empty chart/table or "No data" placeholder. Use provided data if given; otherwise invent believable sample data; if you can't fill a section, omit it.

LAYOUT & POLISH
- Concise header (<h1> text-2xl font-semibold tracking-tight + a muted text-sm subtitle), a responsive KPI Card grid with tabular-nums figures, then charts/tables in Cards. Generous spacing, wrap in <div className="space-y-6">. Lean on the shadcn tokens (bg-card, text-muted-foreground, border) — calm and professional, no loud colored borders.`;

export function createPreviewBuilderAgent() {
  return new Agent({
    id: "preview-builder",
    name: "Preview Builder",
    description:
      "Turns a short brief (and optional inline data) into a complete, self-contained React component for live previews, built from the project's real shadcn/ui registry. Internal helper for the preview_app tool — not a user-facing conversational agent.",
    instructions: PREVIEW_BUILDER_PROMPT,
    // shadcn authoring rules come from the attached Agent Skill (foreman-qdna).
    workspace: previewBuilderWorkspace,
    // Haiku 4.5 — cheap, fast, strong at TSX. The whole point of this agent is to
    // keep verbose component generation off the primary Sonnet model.
    model: MODELS.fast,
    defaultOptions: {
      // Components (especially data dashboards) run long; the provider's default
      // output cap can truncate mid-file. Give it real headroom. Low temperature
      // keeps the markup stable and well-formed.
      modelSettings: { maxOutputTokens: 16000, temperature: 0.3 },
    },
  });
}
