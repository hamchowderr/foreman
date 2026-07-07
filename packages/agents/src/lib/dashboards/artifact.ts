import { randomUUID } from "node:crypto";
import { getSupabase } from "../db";
import { getSnapshotById, type SnapshotRecord } from "./snapshot";
import { type DashboardSpec, dashboardSpecSchema } from "./spec";

/**
 * Artifact persistence — a stored, viewable agent output. Dashboards are the
 * first `kind`; the spec is validated by zod before write (the safety boundary).
 * Records are NOT duplicated here: an artifact references the snapshot it was
 * built from (snapshot_id), and reads resolve the records from that snapshot.
 */

export interface SaveArtifactInput {
  userId: string;
  workspaceId?: string | null;
  kind?: string;
  title: string;
  spec: DashboardSpec;
  snapshotId?: string | null;
  sourceConfig?: unknown;
}

export interface ArtifactWithData {
  id: string;
  kind: string;
  title: string;
  spec: DashboardSpec;
  records: SnapshotRecord[];
  rowCount: number;
  updatedAt: string;
}

export async function saveArtifact(input: SaveArtifactInput): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  // Validate before persisting — never store an invalid spec.
  const spec = dashboardSpecSchema.parse(input.spec);

  const { error } = await supabase.from("artifact").insert({
    id,
    user_id: input.userId,
    workspace_id: input.workspaceId ?? null,
    kind: input.kind ?? "dashboard",
    title: input.title,
    spec: JSON.stringify(spec),
    snapshot_id: input.snapshotId ?? null,
    source_config: input.sourceConfig != null ? JSON.stringify(input.sourceConfig) : null,
    visibility: "private",
    version: 1,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`saveArtifact failed: ${error.message}`);
  return id;
}

/**
 * Load an artifact with the records it renders, scoped to the workspace (a SHARED
 * resource — any workspace member can view it). Returns null if the artifact
 * doesn't exist in this workspace. The spec is re-validated on read so a
 * corrupt/legacy row can't reach the renderer.
 */
export async function getArtifactWithData(
  workspaceId: string | undefined,
  id: string,
): Promise<ArtifactWithData | null> {
  if (!workspaceId) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("artifact")
    .select("id, kind, title, spec, snapshot_id, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  let spec: DashboardSpec;
  try {
    spec = dashboardSpecSchema.parse(JSON.parse(data.spec));
  } catch {
    return null;
  }

  let records: SnapshotRecord[] = [];
  if (data.snapshot_id) {
    const snap = await getSnapshotById(workspaceId, data.snapshot_id);
    if (snap) records = snap.records;
  }

  return {
    id: data.id,
    kind: data.kind,
    title: data.title,
    spec,
    records,
    rowCount: records.length,
    updatedAt: data.updated_at,
  };
}
