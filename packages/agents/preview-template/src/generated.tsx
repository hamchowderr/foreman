import { DollarSign, HandshakeIcon, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { month: "Jan", revenue: 245000 },
  { month: "Feb", revenue: 268000 },
  { month: "Mar", revenue: 312000 },
  { month: "Apr", revenue: 298000 },
  { month: "May", revenue: 356000 },
  { month: "Jun", revenue: 389000 },
  { month: "Jul", revenue: 412000 },
  { month: "Aug", revenue: 398000 },
  { month: "Sep", revenue: 367000 },
  { month: "Oct", revenue: 421000 },
  { month: "Nov", revenue: 445000 },
  { month: "Dec", revenue: 495000 },
];

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(217, 91%, 60%)",
  },
} satisfies ChartConfig;

const averageRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0) / chartData.length;

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your sales performance and key metrics
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Revenue Card */}
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Revenue
                  </CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums text-slate-900">
                    $3,847,200
                  </CardTitle>
                </div>
                <div className="rounded-lg bg-blue-50 p-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge
                variant="secondary"
                className="gap-1 bg-green-50 text-green-700 hover:bg-green-50"
              >
                <TrendingUp className="h-3 w-3" />
                <span>+12.4%</span>
              </Badge>
            </CardContent>
          </Card>

          {/* Deals Won Card */}
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Deals Won
                  </CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums text-slate-900">
                    214
                  </CardTitle>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <HandshakeIcon className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge
                variant="secondary"
                className="gap-1 bg-green-50 text-green-700 hover:bg-green-50"
              >
                <TrendingUp className="h-3 w-3" />
                <span>+8.1%</span>
              </Badge>
            </CardContent>
          </Card>

          {/* Avg Deal Size Card */}
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Avg Deal Size
                  </CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums text-slate-900">
                    $17,978
                  </CardTitle>
                </div>
                <div className="rounded-lg bg-purple-50 p-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge
                variant="secondary"
                className="gap-1 bg-green-50 text-green-700 hover:bg-green-50"
              >
                <TrendingUp className="h-3 w-3" />
                <span>+3.9%</span>
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Monthly Revenue</CardTitle>
            <CardDescription>Revenue trend across 12 months with average baseline</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="hsl(210, 40%, 96%)" strokeDasharray="0" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fill: "hsl(215, 13%, 34%)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  tick={{ fill: "hsl(215, 13%, 34%)", fontSize: 12 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`$${(value as number).toLocaleString()}`, "Revenue"]}
                    />
                  }
                />
                <ReferenceLine
                  y={averageRevenue}
                  stroke="hsl(217, 91%, 60%)"
                  strokeDasharray="5 5"
                  opacity={0.5}
                  label={{
                    value: "Average",
                    position: "right",
                    fill: "hsl(215, 13%, 34%)",
                    fontSize: 12,
                    offset: 10,
                  }}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
