/**
 * Org-level guardrail configuration.
 * For now returns defaults — org admin API will come later.
 */

export interface OrgGuardrailConfig {
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  blockedApps: string[];
  allowedApps: string[];
  requireApprovalForWrites: boolean;
  maxBulkItems: number;
}

const DEFAULTS: OrgGuardrailConfig = {
  rateLimitPerMinute: 30,
  rateLimitPerHour: 200,
  blockedApps: [],
  allowedApps: [],
  requireApprovalForWrites: false,
  maxBulkItems: 5,
};

export function getOrgGuardrailConfig(_orgId?: string): OrgGuardrailConfig {
  // Future: load from capability_flag table or a dedicated config table
  return { ...DEFAULTS };
}
