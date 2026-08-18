import { getSupabase } from "./db";
import { resolveActiveWorkspace } from "./identity";

/**
 * Workspace-level guardrail configuration (foreman-nz8b).
 *
 * This used to be a stub: `getOrgGuardrailConfig(_orgId)` ignored its argument
 * and returned frozen constants, while the landing page advertised "Org admins
 * set guardrail defaults for every member". There was no storage behind it.
 *
 * Foreman's tenancy unit is the WORKSPACE — workspace_members, is_workspace_admin,
 * workspace_settings — not a separate "org", so the settings live on
 * workspace_settings alongside zapier_connection_mode. A NULL column means
 * "inherit the built-in default", so a workspace nobody has configured behaves
 * exactly as it did before.
 */

export interface WorkspaceGuardrailConfig {
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  maxBulkItems: number;
  /** Redact email addresses from agent output. See lib/processors/output.ts. */
  redactEmails: boolean;
}

export const GUARDRAIL_DEFAULTS: WorkspaceGuardrailConfig = {
  rateLimitPerMinute: 30,
  rateLimitPerHour: 200,
  maxBulkItems: 5,
  redactEmails: false,
};

/**
 * Guardrails are consulted on every write tool call and on every output chunk,
 * so an uncached read would put a round trip on the hot path. A short TTL keeps
 * an admin change visible within seconds without that cost.
 */
const TTL_MS = 30_000;
const configCache = new Map<string, { value: WorkspaceGuardrailConfig; expiresAt: number }>();
const userWorkspaceCache = new Map<string, { value: string | null; expiresAt: number }>();

/** Drop cached config — call after an admin write so the change lands immediately. */
export function invalidateGuardrailConfig(workspaceId?: string): void {
  if (workspaceId) configCache.delete(workspaceId);
  else configCache.clear();
}

export async function getWorkspaceGuardrailConfig(
  workspaceId?: string | null,
): Promise<WorkspaceGuardrailConfig> {
  if (!workspaceId) return { ...GUARDRAIL_DEFAULTS };

  const hit = configCache.get(workspaceId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let value: WorkspaceGuardrailConfig = { ...GUARDRAIL_DEFAULTS };
  try {
    const { data } = await getSupabase()
      .from("workspace_settings")
      .select("rate_limit_per_minute, rate_limit_per_hour, max_bulk_items, redact_emails")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (data) {
      value = {
        rateLimitPerMinute: data.rate_limit_per_minute ?? GUARDRAIL_DEFAULTS.rateLimitPerMinute,
        rateLimitPerHour: data.rate_limit_per_hour ?? GUARDRAIL_DEFAULTS.rateLimitPerHour,
        maxBulkItems: data.max_bulk_items ?? GUARDRAIL_DEFAULTS.maxBulkItems,
        redactEmails: data.redact_emails ?? GUARDRAIL_DEFAULTS.redactEmails,
      };
    }
  } catch {
    // Never let a settings read failure disable the limiter — fall back to the
    // built-in defaults, which are stricter than having no guardrail at all.
  }

  configCache.set(workspaceId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/**
 * Resolve the guardrail config that applies to a user, via their active
 * workspace. Both lookups are cached because this runs per tool call.
 */
export async function guardrailConfigForUser(userId: string): Promise<WorkspaceGuardrailConfig> {
  const cached = userWorkspaceCache.get(userId);
  let workspaceId: string | null;
  if (cached && cached.expiresAt > Date.now()) {
    workspaceId = cached.value;
  } else {
    workspaceId = await resolveActiveWorkspace(userId).catch(() => null);
    userWorkspaceCache.set(userId, { value: workspaceId, expiresAt: Date.now() + TTL_MS });
  }
  return getWorkspaceGuardrailConfig(workspaceId);
}
