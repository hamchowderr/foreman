"use client";

import { useMemo } from "react";
import DataGrid from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  Aggregation,
  DashboardBlock,
  DashboardSpec,
  SnapshotRecord,
} from "@/lib/dashboards-client";

const MAX_CHART_CATEGORIES = 12;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function aggregate(records: SnapshotRecord[], field: string | undefined, agg: Aggregation): number {
  if (agg === "count" || !field) return records.length;
  const values = records.map((r) => num(r[field])).filter((v): v is number => v !== null);
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function KpiBlock({
  block,
  records,
}: {
  block: Extract<DashboardBlock, { type: "kpi" }>;
  records: SnapshotRecord[];
}) {
  const value = aggregate(records, block.field, block.agg);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "#7A6A5C" }}
        >
          {block.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums" style={{ color: "#201515" }}>
          {formatNumber(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartBlock({
  block,
  records,
}: {
  block: Extract<DashboardBlock, { type: "chart" }>;
  records: SnapshotRecord[];
}) {
  const data = useMemo(() => {
    const groups = new Map<string, number>();
    for (const r of records) {
      const key = String(r[block.xField] ?? "—");
      const add = block.agg === "count" ? 1 : (num(block.yField ? r[block.yField] : null) ?? 0);
      groups.set(key, (groups.get(key) ?? 0) + add);
    }
    return [...groups.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_CHART_CATEGORIES);
  }, [records, block.xField, block.yField, block.agg]);

  const config: ChartConfig = {
    value: { label: block.agg === "count" ? "Count" : block.yField, color: "#FF4F00" },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium" style={{ color: "#201515" }}>
          {block.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm" style={{ color: "#7A6A5C" }}>
            No data to chart.
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
            <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#FFE8D6" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "#7A6A5C" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fontSize: 11, fill: "#7A6A5C" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#FF4F00" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TableBlock({
  block,
  records,
}: {
  block: Extract<DashboardBlock, { type: "table" }>;
  records: SnapshotRecord[];
}) {
  const columns = useMemo(() => block.columns.map((c) => ({ key: c, name: c })), [block.columns]);
  const rows = useMemo(
    () =>
      records.map((r, i) => {
        const row: Record<string, string> = { __id: String(i) };
        for (const c of block.columns) {
          const v = r[c];
          row[c] =
            v === null || v === undefined
              ? ""
              : typeof v === "object"
                ? JSON.stringify(v)
                : String(v);
        }
        return row;
      }),
    [records, block.columns],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium" style={{ color: "#201515" }}>
          {block.label ?? "Records"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm" style={{ color: "#7A6A5C" }}>
            No records.
          </div>
        ) : (
          <div className="rounded-md border" style={{ borderColor: "#FFF3E6" }}>
            <DataGrid
              columns={columns}
              rows={rows}
              rowKeyGetter={(r) => r.__id}
              rowHeight={35}
              headerRowHeight={35}
              defaultColumnOptions={{ resizable: true, minWidth: 140 }}
              className="rdg-light"
              style={{ blockSize: Math.min(460, 35 + (rows.length + 1) * 35) }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Content-stable key for a block (avoids index-as-key; blocks don't reorder). */
function blockKey(b: DashboardBlock): string {
  if (b.type === "kpi") return `kpi-${b.agg}-${b.field ?? "count"}-${b.label}`;
  if (b.type === "chart") return `chart-${b.xField}-${b.yField ?? "count"}-${b.agg}`;
  return `table-${b.columns.join(",")}`;
}

export function DashboardRenderer({ spec, data }: { spec: DashboardSpec; data: SnapshotRecord[] }) {
  const kpis = spec.blocks.filter(
    (b): b is Extract<DashboardBlock, { type: "kpi" }> => b.type === "kpi",
  );
  const rest = spec.blocks.filter((b) => b.type !== "kpi");

  return (
    <div className="space-y-6">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((b) => (
            <KpiBlock key={blockKey(b)} block={b} records={data} />
          ))}
        </div>
      )}
      {rest.map((b) => {
        if (b.type === "chart") return <ChartBlock key={blockKey(b)} block={b} records={data} />;
        if (b.type === "table") return <TableBlock key={blockKey(b)} block={b} records={data} />;
        return null;
      })}
    </div>
  );
}
