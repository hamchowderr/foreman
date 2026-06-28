/**
 * Typed client + spec types for the /apps/* routes on the agents server.
 *
 * Server components pass a Supabase access token directly; client components go
 * through app/api/apps/[...path]/route.ts which injects the same token.
 * Shapes mirror packages/agents/src/lib/dashboards/snapshot.ts.
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export type SnapshotRecord = Record<string, unknown>;

export interface Snapshot {
  id: string;
  appKey: string;
  sourceConfig: unknown;
  records: SnapshotRecord[];
  rowCount: number;
  refreshedAt: string;
}

export interface SnapshotHistory {
  appKey: string;
  count: number;
  snapshots: Snapshot[];
}

// ─── Dashboard spec ─────────────────────────────────────────────────────────
//
// A constrained, JSON-serializable description of a dashboard. The agent emits
// this (Phase 2 tool); the DashboardRenderer composes it from installed
// shadcn/recharts/react-data-grid components. No code execution → safe to
// render in-app and (later) on public pages. This type is the contract; the
// agent-server zod schema will mirror it.

export type Aggregation = "count" | "sum" | "avg" | "min" | "max";

export type DashboardBlock =
  | { type: "kpi"; label: string; field?: string; agg: Aggregation }
  | {
      type: "chart";
      chartType: "bar" | "line";
      label: string;
      xField: string;
      yField?: string;
      agg: "count" | "sum";
    }
  | { type: "table"; label?: string; columns: string[] };

export interface DashboardSpec {
  title: string;
  blocks: DashboardBlock[];
}

async function request<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export interface DashboardArtifact {
  id: string;
  kind: string;
  title: string;
  spec: DashboardSpec;
  records: SnapshotRecord[];
  rowCount: number;
  updatedAt: string;
}

/** A stored dashboard artifact (spec + records) by id, or null on 404. */
export async function getArtifact(id: string, token: string): Promise<DashboardArtifact | null> {
  try {
    return await request<DashboardArtifact>(`/apps/artifacts/${encodeURIComponent(id)}`, token);
  } catch (e) {
    if ((e as Error).message.includes("→ 404")) return null;
    throw e;
  }
}

/**
 * A publicly shared dashboard by share token, or null on 404 / expired token.
 * No auth — hits the agent server's public endpoint directly (the token is the
 * capability). Dynamic (no-store) so the share reflects the latest snapshot.
 */
export async function getPublicDashboard(shareToken: string): Promise<DashboardArtifact | null> {
  const res = await fetch(`${AGENT_URL}/apps/public/${encodeURIComponent(shareToken)}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET /apps/public → ${res.status}: ${body}`);
  }
  return (await res.json()) as DashboardArtifact;
}

export interface SnapshotApp {
  appKey: string;
  refreshedAt: string;
  rowCount: number;
}

/**
 * The apps that have data in the caller's workspace, newest-refreshed first.
 * Lets the Apps page default to a real source instead of a hardcoded one
 * (foreman-djo7). Returns [] if none / on error.
 */
export async function listSnapshotApps(token: string): Promise<SnapshotApp[]> {
  try {
    const { apps } = await request<{ apps: SnapshotApp[] }>("/apps", token);
    return apps ?? [];
  } catch {
    return [];
  }
}

/** Latest snapshot for an app, or null on 404 (no data pulled yet). */
export async function getLatestSnapshot(appKey: string, token: string): Promise<Snapshot | null> {
  try {
    return await request<Snapshot>(`/apps/snapshots/${encodeURIComponent(appKey)}`, token);
  } catch (e) {
    if ((e as Error).message.includes("→ 404")) return null;
    throw e;
  }
}

export function getSnapshotHistory(
  appKey: string,
  token: string,
  opts: { since?: string; limit?: number } = {},
): Promise<SnapshotHistory> {
  const qs = new URLSearchParams({ history: "true" });
  if (opts.since) qs.set("since", opts.since);
  if (opts.limit) qs.set("limit", String(opts.limit));
  return request<SnapshotHistory>(`/apps/snapshots/${encodeURIComponent(appKey)}?${qs}`, token);
}

// ─── Default spec inference ──────────────────────────────────────────────────
//
// Until the agent generates+stores a spec (rest of Phase 2), derive a sensible
// default from the snapshot records so a dashboard is viewable immediately:
// KPIs (row count + sum/avg of the first numeric field), a bar chart (first
// numeric grouped by first categorical, else counts by first categorical), and
// a table of all columns.

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function defaultSpecFromRecords(appKey: string, records: SnapshotRecord[]): DashboardSpec {
  const title = `${appKey} overview`;
  const blocks: DashboardBlock[] = [];

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

  return { title, blocks };
}
