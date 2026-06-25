import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/db";

export type SnapshotRecord = Record<string, unknown>;

export interface SaveSnapshotInput {
  userId: string;
  workspaceId?: string | null;
  appKey: string;
  /** the source/query config used to pull this data (provenance + refresh basis) */
  sourceConfig: unknown;
  /** the pulled records */
  records: SnapshotRecord[];
  /** the trigger that produced this snapshot, if any */
  triggerId?: string | null;
}

export interface Snapshot {
  id: string;
  appKey: string;
  sourceConfig: unknown;
  records: SnapshotRecord[];
  rowCount: number;
  refreshedAt: string;
}

/**
 * Append a new snapshot row — one row per refresh (NEVER an upsert) so history is
 * preserved for trend charts. JSON payloads are stored as text, matching the other
 * Foreman core tables (e.g. workflow.parameters, action_proposal.inputs).
 */
export async function saveSnapshot(input: SaveSnapshotInput): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const rowCount = Array.isArray(input.records) ? input.records.length : 0;

  const { error } = await supabase.from("app_data_snapshot").insert({
    id,
    user_id: input.userId,
    workspace_id: input.workspaceId ?? null,
    app_key: input.appKey,
    source_config: JSON.stringify(input.sourceConfig ?? {}),
    records: JSON.stringify(input.records ?? []),
    row_count: rowCount,
    trigger_id: input.triggerId ?? null,
    refreshed_at: now,
    created_at: now,
  });
  if (error) throw new Error(`saveSnapshot failed: ${error.message}`);

  // Bound the append-only table after each append — best-effort, so a prune
  // hiccup never fails a refresh. Prune is workspace-scoped; without a workspace
  // it's a no-op (a workspace-less snapshot is invisible to the dashboards reads).
  try {
    await pruneSnapshots(input.workspaceId ?? undefined, input.appKey);
  } catch (e) {
    console.error("[saveSnapshot] prune failed (non-fatal):", (e as Error).message);
  }

  return id;
}

/** How many snapshots to keep per (workspace, app_key). Count-based, not
 * time-based: a time window (e.g. 90d) doesn't bound growth for frequent polls,
 * whereas a hard count does. Set generously so the history endpoint (limit ≤ 500)
 * still has data for trend charts. */
const DEFAULT_KEEP_LAST = 200;
/** Cap deletions per call so a one-time backfill drains over several refreshes
 * instead of building a giant `.in(...)` URL that PostgREST would reject. */
const MAX_PRUNE_BATCH = 200;

/**
 * Retention: keep the newest `keepLast` snapshots per (workspace, app_key) and
 * delete older ones. NEVER deletes a snapshot a dashboard artifact is pinned to —
 * `getArtifactWithData` resolves records by `snapshot_id`, so pruning a
 * referenced row would blank that dashboard. Returns the number deleted.
 * Snapshots are a SHARED workspace resource, so retention is per workspace.
 */
export async function pruneSnapshots(
  workspaceId: string | undefined,
  appKey: string,
  opts: { keepLast?: number } = {},
): Promise<number> {
  if (!workspaceId) return 0;
  const keepLast = opts.keepLast ?? DEFAULT_KEEP_LAST;
  const supabase = getSupabase();

  // Newest-first ids only (cheap; covered by the (workspace_id, app_key,
  // refreshed_at) index). Fast path: nothing beyond the window.
  const { data: rows } = await supabase
    .from("app_data_snapshot")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("app_key", appKey)
    .order("refreshed_at", { ascending: false });
  if (!rows || rows.length <= keepLast) return 0;

  // Everything past the newest `keepLast` is a candidate; drain oldest-first in
  // bounded batches.
  const candidates = rows
    .slice(keepLast)
    .map((r) => r.id)
    .slice(-MAX_PRUNE_BATCH);

  // Exclude snapshots a dashboard artifact still references.
  const { data: referenced } = await supabase
    .from("artifact")
    .select("snapshot_id")
    .eq("workspace_id", workspaceId)
    .in("snapshot_id", candidates);
  const pinned = new Set((referenced ?? []).map((r) => r.snapshot_id as string));
  const toDelete = candidates.filter((id) => !pinned.has(id));
  if (toDelete.length === 0) return 0;

  const { error } = await supabase
    .from("app_data_snapshot")
    .delete()
    .eq("workspace_id", workspaceId)
    .in("id", toDelete);
  if (error) throw new Error(`pruneSnapshots failed: ${error.message}`);
  return toDelete.length;
}

/** Latest snapshot for a workspace's app source, or null if none exists yet. */
export async function getLatestSnapshot(
  workspaceId: string | undefined,
  appKey: string,
): Promise<Snapshot | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_data_snapshot")
    .select("id, app_key, source_config, records, row_count, refreshed_at")
    .eq("workspace_id", workspaceId)
    .eq("app_key", appKey)
    .order("refreshed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToSnapshot(data) : null;
}

/** A specific snapshot by id, scoped to the workspace. Null if not found. */
export async function getSnapshotById(
  workspaceId: string | undefined,
  id: string,
): Promise<Snapshot | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_data_snapshot")
    .select("id, app_key, source_config, records, row_count, refreshed_at")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return data ? rowToSnapshot(data) : null;
}

/** Historical snapshots (newest first) for trend charts; optionally only since a timestamp. */
export async function getSnapshotHistory(
  workspaceId: string | undefined,
  appKey: string,
  opts: { since?: string; limit?: number } = {},
): Promise<Snapshot[]> {
  if (!workspaceId) return [];
  const supabase = getSupabase();
  let query = supabase
    .from("app_data_snapshot")
    .select("id, app_key, source_config, records, row_count, refreshed_at")
    .eq("workspace_id", workspaceId)
    .eq("app_key", appKey)
    .order("refreshed_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.since) query = query.gte("refreshed_at", opts.since);
  const { data } = await query;
  return (data ?? []).map(rowToSnapshot);
}

function rowToSnapshot(row: {
  id: string;
  app_key: string;
  source_config: string;
  records: string;
  row_count: number;
  refreshed_at: string;
}): Snapshot {
  return {
    id: row.id,
    appKey: row.app_key,
    sourceConfig: safeParse(row.source_config),
    records: (safeParse(row.records) as SnapshotRecord[]) ?? [],
    rowCount: row.row_count,
    refreshedAt: row.refreshed_at,
  };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
