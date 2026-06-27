---
name: shadcn
description: Authoritative rules for writing a single React (TSX) component from Foreman's pre-installed shadcn/ui registry — exact import map, the ChartContainer/ChartConfig and DataTable/ColumnDef contracts, react-hook-form+zod forms, and the specific type-error pitfalls to avoid. Load this BEFORE writing any preview component (dashboard, chart, table, report, form, or small tool).
---

# Writing shadcn/ui components for the Foreman live preview

You write ONE self-contained React component that is rendered inside a warm Vite + React 19 + Tailwind v4 + shadcn/ui app. **Every component is already installed** — you never run a CLI, never add dependencies, never write CSS or a registry file. You import the real components and compose them. Your only job is correct, type-checking TSX that uses the design system idiomatically.

The single most common failure is **importing a name that is not a real export, or passing a prop/variant that doesn't exist** — that fails `tsc` and triggers a rebuild. The rules below exist to prevent exactly that.

## Output contract (never break these)

- Emit ONLY the raw contents of one `.tsx` file. No markdown fences, no prose before or after.
- Exactly one component as the **default export**, taking **no props**: `export default function Dashboard() { … }`.
- No CSS imports, no `<style>` tag, no raw `<script>`, no runtime `fetch`, no `import` of any package outside the allowed set below.
- Prefer real, internally-consistent inline data. NEVER render an empty chart/table or a "No data" placeholder — invent believable sample data if none is given. If you can't fill a section, omit it.

## Import map — which name comes from which module

Import each component from `@/components/ui/<name>` using its **exact** export names. Getting the module right is what prevents "has no exported member" errors.

| Module (`@/components/ui/…`) | Exact exports you'll use |
| --- | --- |
| `card` | `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter` |
| `badge` | `Badge` — variants: `default \| secondary \| destructive \| outline` only |
| `button` | `Button` — variants: `default \| destructive \| outline \| secondary \| ghost \| link`; sizes: `default \| sm \| lg \| icon` |
| `table` | `Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption` |
| `data-table` | `DataTable, DataTableColumnHeader` (custom — sortable/filterable/paginated) |
| `chart` | `ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent` + `type ChartConfig` |
| `tabs` | `Tabs, TabsList, TabsTrigger, TabsContent` |
| `select` | `Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel` |
| `tooltip` | `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` |
| `dropdown-menu` | `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator` |
| `input` / `label` / `textarea` / `checkbox` / `switch` / `slider` / `progress` / `separator` / `skeleton` / `avatar` | `Input` / `Label` / `Textarea` / `Checkbox` / `Switch` / `Slider` / `Progress` / `Separator` / `Skeleton` / `Avatar, AvatarImage, AvatarFallback` |
| `sonner` | `Toaster` (render `<Toaster />` once; call `toast()` from the `sonner` package, not from here) |

Full registry available (import any by `@/components/ui/<name>`):
`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, data-table, dialog, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, menubar, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip`.

If you are unsure of a component's exact export names, use `skill_read` on this skill's `references/` or pick a simpler component you're sure of. **Never guess an export name** — a wrong guess fails the type-check.

## Allowed direct library imports

```ts
import * as React from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
         CartesianGrid, XAxis, YAxis } from "recharts";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { TrendingUp, Users /* any real lucide icon */ } from "lucide-react";
import { cn } from "@/lib/utils";
```

`lucide-react` icon names are **PascalCase and must exist** (e.g. `TrendingUp`, `ArrowUpRight`, `DollarSign`). A misspelled icon is a missing export → type error.

## Charts — the ChartContainer / ChartConfig contract

shadcn charts wrap recharts. Two rules prevent both the type error and the "chart renders empty" bug:

1. `ChartContainer` MUST have an **explicit height** class. Without it the chart collapses to 0px.
2. `ChartContainer` already renders a `ResponsiveContainer` internally — **do NOT wrap the chart in your own `ResponsiveContainer`** (double container → 0-height).
3. `ChartConfig` keys MUST match each series' `dataKey`. Reference each series color as `var(--color-KEY)`; define the palette with `var(--chart-1)`..`var(--chart-5)`.

```tsx
const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

<ChartContainer config={chartConfig} className="h-[280px] w-full">
  <BarChart data={data} accessibilityLayer>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
    <YAxis tickLine={false} axisLine={false} width={48} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
  </BarChart>
</ChartContainer>
```

## Tables — the DataTable / ColumnDef contract

For tabular/list data prefer `DataTable` (sortable, filterable, paginated). Define a `Row` type so `accessorKey` is type-checked against it — this is what catches typos at compile time.

```tsx
type Row = { id: string; name: string; amount: number; status: "paid" | "due" };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <span className="tabular-nums">${row.original.amount.toLocaleString()}</span>,
  },
  { accessorKey: "status", header: "Status",
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
];

<DataTable columns={columns} data={rows} filterColumn="name" />
```

`filterColumn` must equal one of the `accessorKey`s. For a tiny static table the plain `Table` primitives are fine.

## Forms — react-hook-form + zod

Use `Controller` for shadcn inputs that don't forward a ref the way `register` expects (`Select`, `Switch`, `Checkbox`, `Slider`, `RadioGroup`). Type the form from the schema.

```tsx
const schema = z.object({ email: z.string().email(), plan: z.enum(["free", "pro"]) });
type Values = z.infer<typeof schema>;

const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", plan: "free" } });
```

## Pitfalls that fail `tsc` (avoid every one)

- Importing a name from the wrong module (e.g. `TableHead` from `card`, `Toaster` from anywhere but `sonner`).
- A `Badge`/`Button` `variant` or `Button` `size` that isn't in the lists above.
- `ChartConfig` keys that don't match the chart's `dataKey`s; missing `satisfies ChartConfig`.
- `ColumnDef<Row>` with an `accessorKey` that isn't a key of `Row`; or omitting the `Row` type so everything is `any`.
- Wrapping a `ChartContainer` child in your own `ResponsiveContainer`.
- A misspelled `lucide-react` icon (no such export).
- Importing a CSS file, a `<style>` tag, a runtime `fetch`, or any package not listed above.

## Layout & polish

- Header: an `<h1>` (`text-2xl font-semibold tracking-tight`) + a muted one-line subtitle (`text-sm text-muted-foreground`).
- KPI row: responsive grid of `Card`s (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). In each, `CardHeader` → `CardDescription` (small muted label) + a big `CardTitle` value (`text-3xl font-semibold tabular-nums`); a calm `Badge variant="secondary"` with a small lucide trend icon in `CardAction`. Use `tabular-nums` on every figure.
- Charts in `Card`s below in a grid that stacks on small screens (`grid gap-4 lg:grid-cols-2`). Generous spacing (`gap-4`/`gap-6`, `p-6`); wrap everything in `<div className="space-y-6">`.
- Stay calm and professional: lean on the shadcn tokens (`bg-card`, `text-muted-foreground`, `border`). Do NOT add loud colored borders or bars — the design system is already polished; don't re-skin it.
