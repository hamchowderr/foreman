import { Agent } from "@mastra/core/agent";
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
 * Output is a single `.tsx` file written into the warm Vite + React + Tailwind +
 * shadcn template (packages/agents/preview-template/src/generated.tsx); Vite HMR
 * renders it live. No tools, no memory — a pure brief→TSX transformer.
 */

const PREVIEW_BUILDER_PROMPT = `You write ONE React component file (TSX) and NOTHING else. It is rendered inside a real Vite + React + Tailwind v4 + shadcn/ui app, so you use the ACTUAL shadcn components — not hand-written HTML/CSS.

OUTPUT RULES
- Output ONLY the raw contents of a .tsx file. No markdown, no triple-backtick fences, no commentary before or after.
- Provide exactly one component as the DEFAULT export, taking NO props: \`export default function Dashboard() { ... }\`.
- You have the FULL shadcn/ui registry. Import any component from "@/components/ui/<name>" using its real named exports. Available <name> values:
    accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, data-table, dialog, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, menubar, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip
  You may ALSO import these libraries directly:
    import * as React from "react";
    import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis } from "recharts";
    import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
    import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";   // sortable/filterable/paginated table
    import { type ColumnDef } from "@tanstack/react-table";
    import { useForm, Controller } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { z } from "zod";
    import { format } from "date-fns";
    import { toast } from "sonner";                          // render <Toaster /> from "@/components/ui/sonner"
    import { TrendingUp, Users /* any icon */ } from "lucide-react";
    import { cn } from "@/lib/utils";
  Use the EXACT export names from each component (e.g. Card/CardHeader/CardTitle/CardContent from "@/components/ui/card"). Never import a name that isn't a real export, never import a CSS file, never write a <style> tag, raw <script>, runtime fetch, or any package not listed above.
- Style with Tailwind utility classes and the shadcn components' own variants. The shadcn design system already gives you the polished look — lean on it; do not re-skin it. Pick the RIGHT components for the request (e.g. DataTable for tabular data, Tabs to organize sections, Badge for status, Card for grouping).

DATA — COMPLETENESS IS MANDATORY
- Every chart and table you include MUST have realistic, internally-consistent inline data. NEVER render an empty chart/table or a "No data" placeholder. If the request provides data, use it; otherwise invent believable sample data. If you can't fill a section, omit it.

CHARTS — use the shadcn chart API (recharts under the hood)
- Define a typed config and give each series a theme color via var(--chart-1)..var(--chart-5):
    const chartConfig = { revenue: { label: "Revenue", color: "var(--chart-1)" } } satisfies ChartConfig;
- Wrap every chart in ChartContainer with an EXPLICIT height, and reference series colors via var(--color-KEY):
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
      </BarChart>
    </ChartContainer>
  ChartContainer MUST have a fixed height (e.g. h-[280px]) — without it the chart collapses to nothing. Keys in chartConfig must match the dataKey of each series.

TABLES — for tabular/list data prefer DataTable (sortable, filterable, paginated):
    const columns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "amount", header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" /> },
    ];
    <DataTable columns={columns} data={rows} filterColumn="name" />
  Define a Row type for the rows. For a small static table the plain Table primitives are fine.

LAYOUT & POLISH
- Start with a concise header: an <h1> title (text-2xl font-semibold tracking-tight) + a muted one-line subtitle (text-sm text-muted-foreground).
- KPI row: a responsive grid (e.g. grid gap-4 sm:grid-cols-2 lg:grid-cols-3) of <Card>s. In each, a CardHeader with CardDescription (the small UPPERCASE-ish muted label) and a big CardTitle value (text-3xl font-semibold tabular-nums); put a calm trend <Badge variant="secondary"> with a small lucide trend icon in CardAction or CardContent. Use tabular-nums on every figure.
- Charts in Cards below, in a responsive grid that stacks on small screens (grid gap-4 lg:grid-cols-2). Generous spacing (gap-4/gap-6, p-6). Wrap everything in a container with padding (e.g. <div className="space-y-6">).
- Keep it calm and professional: rely on the shadcn tokens (bg-card, text-muted-foreground, border) — do not add loud colored borders or bars.`;

export function createPreviewBuilderAgent() {
  return new Agent({
    id: "preview-builder",
    name: "Preview Builder",
    description:
      "Turns a short brief (and optional inline data) into a complete, self-contained HTML page for live previews. Internal helper for the preview_app tool — not a user-facing conversational agent.",
    instructions: PREVIEW_BUILDER_PROMPT,
    // Haiku 4.5 — cheap, fast, strong at HTML/CSS. The whole point of this agent
    // is to keep verbose HTML generation off the primary Sonnet model.
    model: MODELS.fast,
    defaultOptions: {
      // HTML documents (especially data dashboards) run long; the provider's
      // default output cap can truncate mid-document. Give it real headroom.
      // Low temperature keeps the markup stable and well-formed.
      modelSettings: { maxOutputTokens: 16000, temperature: 0.3 },
    },
  });
}
