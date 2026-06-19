import { z } from "zod";

/**
 * Dashboard spec — a constrained, JSON-serializable description of a dashboard
 * that the agent produces and the web DashboardRenderer composes from installed
 * shadcn/recharts/react-data-grid components. No code execution.
 *
 * This zod schema is the SAFETY BOUNDARY: every spec is validated here before it
 * is stored or rendered (in-app and, later, on public share pages). Labels are
 * length-capped, block counts are bounded, objects are .strict() (no extra
 * keys), and there are no html/url/onClick/template fields anywhere.
 *
 * Keep this in lockstep with the TS types in
 * packages/web/src/lib/dashboards-client.ts (the renderer's contract).
 */

const label = z.string().min(1).max(200);
const field = z.string().min(1).max(200);

const kpiBlock = z
  .object({
    type: z.literal("kpi"),
    label,
    field: field.optional(),
    agg: z.enum(["count", "sum", "avg", "min", "max"]),
  })
  .strict();

const chartBlock = z
  .object({
    type: z.literal("chart"),
    chartType: z.enum(["bar", "line"]),
    label,
    xField: field,
    yField: field.optional(),
    agg: z.enum(["count", "sum"]),
  })
  .strict();

const tableBlock = z
  .object({
    type: z.literal("table"),
    label: label.optional(),
    columns: z.array(field).min(1).max(50),
  })
  .strict();

export const dashboardBlockSchema = z.discriminatedUnion("type", [
  kpiBlock,
  chartBlock,
  tableBlock,
]);

export const dashboardSpecSchema = z
  .object({
    title: label,
    blocks: z.array(dashboardBlockSchema).min(1).max(20),
  })
  .strict();

export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;

type SnapshotRecord = Record<string, unknown>;

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Derive a sensible default dashboard spec from a set of records: KPIs (row
 * count + sum/avg of the first numeric field), a bar chart (first numeric grouped
 * by the first categorical, else counts by the first categorical), and a table of
 * all columns. Mirrors defaultSpecFromRecords in the web client so the in-app and
 * agent-generated specs stay consistent.
 */
export function buildDefaultSpec(
  appKey: string,
  records: SnapshotRecord[],
  titleOverride?: string,
): DashboardSpec {
  const title = titleOverride?.trim() || `${appKey} overview`;
  const blocks: z.infer<typeof dashboardBlockSchema>[] = [];

  const sample = records[0] ?? {};
  const columns = Object.keys(sample);
  const numericFields = columns.filter((c) => records.some((r) => isNumeric(r[c])));
  const categoricalFields = columns.filter(
    (c) => !numericFields.includes(c) && records.some((r) => typeof r[c] === "string"),
  );

  blocks.push({ type: "kpi", label: "Total records", agg: "count" });
  if (numericFields[0]) {
    blocks.push({
      type: "kpi",
      label: `Total ${numericFields[0]}`,
      field: numericFields[0],
      agg: "sum",
    });
    blocks.push({
      type: "kpi",
      label: `Avg ${numericFields[0]}`,
      field: numericFields[0],
      agg: "avg",
    });
  }

  if (categoricalFields[0]) {
    blocks.push(
      numericFields[0]
        ? {
            type: "chart",
            chartType: "bar",
            label: `${numericFields[0]} by ${categoricalFields[0]}`,
            xField: categoricalFields[0],
            yField: numericFields[0],
            agg: "sum",
          }
        : {
            type: "chart",
            chartType: "bar",
            label: `Count by ${categoricalFields[0]}`,
            xField: categoricalFields[0],
            agg: "count",
          },
    );
  }

  if (columns.length > 0) {
    blocks.push({ type: "table", label: "Records", columns });
  }

  // Validate our own output — cheap insurance that the builder never emits an
  // invalid spec, and the same gate any agent-authored spec must pass.
  return dashboardSpecSchema.parse({ title, blocks });
}
