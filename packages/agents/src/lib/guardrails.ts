/**
 * The guardrails that actually run: per-user rate limiting and sensitive-app
 * blocking, both enforced in the generated Zapier tools' execute path
 * (`zapier-sdk-tools.ts`) and reported by `GET /guardrails/status`.
 *
 * This file used to be larger. `runGuardrails`, `assessActionRisk` and
 * `needsBulkConfirmation` were removed with foreman-nz8b: their only caller was
 * the deleted `lib/zapier/execution.ts`, so they had been scoring risk for a
 * code path nothing executed, with unit tests that stayed green the whole time.
 * The one job they were still claimed to do — warning about bulk writes — is
 * now done where a warning can be read, on the approval prompt itself
 * (`web/src/lib/action-scope.ts`), against the workspace's `max_bulk_items`.
 */
import { checkCapability } from "./capabilities";
import { getSupabase } from "./db";
import { GUARDRAIL_DEFAULTS } from "./guardrails-config";

// ─── Rate Limiter (in-memory, sliding window) ───

interface WindowCounters {
  minute: number[];
  hour: number[];
}

const rateLimitStore = new Map<string, WindowCounters>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, counters] of rateLimitStore) {
    counters.minute = counters.minute.filter((t) => now - t < 60_000);
    counters.hour = counters.hour.filter((t) => now - t < 3_600_000);
    if (counters.minute.length === 0 && counters.hour.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000);

export async function checkRateLimit(
  userId: string,
  limits?: { perMinute?: number; perHour?: number; peek?: boolean },
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  // Callers that know the workspace pass its configured limits; the built-in
  // defaults are the fallback and live in one place (guardrails-config.ts).
  const perMinute = limits?.perMinute ?? GUARDRAIL_DEFAULTS.rateLimitPerMinute;
  const perHour = limits?.perHour ?? GUARDRAIL_DEFAULTS.rateLimitPerHour;
  const now = Date.now();

  let counters = rateLimitStore.get(userId);
  if (!counters) {
    counters = { minute: [], hour: [] };
    rateLimitStore.set(userId, counters);
  }

  // Prune expired timestamps
  counters.minute = counters.minute.filter((t) => now - t < 60_000);
  counters.hour = counters.hour.filter((t) => now - t < 3_600_000);

  // Check minute limit
  if (counters.minute.length >= perMinute) {
    const oldest = counters.minute[0];
    return { allowed: false, retryAfterMs: 60_000 - (now - oldest) };
  }

  // Check hour limit
  if (counters.hour.length >= perHour) {
    const oldest = counters.hour[0];
    return { allowed: false, retryAfterMs: 3_600_000 - (now - oldest) };
  }

  // Record this action — unless the caller only wanted to read the state.
  // `GET /guardrails/status` is a read: charging a user for looking at their own
  // remaining budget was a real bug, not a rounding error.
  if (!limits?.peek) {
    counters.minute.push(now);
    counters.hour.push(now);
  }

  return { allowed: true };
}

// ─── Sensitive App Access ───

export const SENSITIVE_APP_CATEGORIES: Record<string, string[]> = {
  banking: ["stripe", "paypal", "square", "plaid", "wise"],
  hr: ["bamboohr", "gusto", "rippling", "workday", "adp"],
  security: ["okta", "auth0", "onepassword"],
};

/** Flat set of all sensitive app keys for fast lookup. */
const SENSITIVE_APPS = new Set(Object.values(SENSITIVE_APP_CATEGORIES).flat());

/** Returns which category a sensitive app belongs to, or null. */
function getSensitiveCategory(appKey: string): string | null {
  const lower = appKey.toLowerCase();
  for (const [category, apps] of Object.entries(SENSITIVE_APP_CATEGORIES)) {
    if (apps.includes(lower)) return category;
  }
  return null;
}

export async function checkAppAccess(
  userId: string,
  appKey: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const lower = appKey.toLowerCase();

  if (!SENSITIVE_APPS.has(lower)) {
    return { allowed: true };
  }

  const category = getSensitiveCategory(lower);
  if (!category) return { allowed: true };

  // Check capability flag "app:<category>" — defaults to false (blocked) for sensitive apps
  // checkCapability returns true if no row exists, but for sensitive apps we want opt-in,
  // so we invert: the flag must be explicitly set to true.
  const capKey = `app:${category}`;
  const _enabled = await checkCapability(userId, capKey);

  // checkCapability defaults to true (no row = enabled). For sensitive apps,
  // we need the opposite: no row = blocked. So we check if a row exists
  // by also checking if the capability is in the standard set — it won't be,
  // meaning checkCapability's "default true" applies. We need explicit opt-in.
  // Solution: use a dedicated check that defaults to false.
  const allowed = await checkSensitiveAppCapability(userId, capKey);

  if (!allowed) {
    return {
      allowed: false,
      reason: `Access to ${category} apps (${appKey}) is blocked. Enable the "app:${category}" capability to allow access.`,
    };
  }

  return { allowed: true };
}

/**
 * Check a sensitive-app capability. Unlike checkCapability (which defaults to true),
 * this defaults to FALSE — sensitive apps are opt-in.
 */
async function checkSensitiveAppCapability(userId: string, capability: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("capability_flag")
    .select("enabled")
    .eq("user_id", userId)
    .eq("capability", capability)
    .limit(1)
    .single();

  // No row = disabled (opt-in for sensitive apps)
  if (!data) return false;
  return data.enabled;
}

// ─── Known Zapier action permissions (admin restrictions, SDK 0.112.5) ───

/**
 * `listActions` / `getAction` / `listTriggers` return a `permissions` map per
 * action; `permissions.can_use === false` means a Zapier account admin has
 * restricted that action. We never fetch it just to check — that would add a
 * network round-trip to every run. Instead the generated discovery tools record
 * what they already saw (`recordActionPermissions`), and the run-action
 * pre-check consults it (`checkKnownActionPermission`). Unknown ⇒ allowed:
 * Zapier still enforces the restriction server-side; this only turns a known
 * dead end into a clear message before the call.
 *
 * In-memory, per user, short TTL — admins can lift a restriction.
 */
const ACTION_PERMISSION_TTL_MS = 10 * 60_000;
const actionPermissionStore = new Map<string, { canUse: boolean; expiresAt: number }>();

function actionPermissionKey(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
): string {
  return JSON.stringify([
    userId,
    appKey.toLowerCase(),
    actionType.toLowerCase(),
    actionKey.toLowerCase(),
  ]);
}

interface ActionPermissionItem {
  key?: unknown;
  app_key?: unknown;
  action_type?: unknown;
  permissions?: unknown;
}

/**
 * Remember the `can_use` flag of action items a discovery call already returned.
 * `requestedApp` is the app key the caller passed (e.g. "slack"); the item's own
 * `app_key` may be spelled differently, so both are recorded.
 */
export function recordActionPermissions(
  userId: string,
  requestedApp: string | undefined,
  items: readonly ActionPermissionItem[],
): void {
  const expiresAt = Date.now() + ACTION_PERMISSION_TTL_MS;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { key, app_key, action_type, permissions } = item;
    if (typeof key !== "string" || typeof action_type !== "string") continue;
    const canUse = (permissions as { can_use?: unknown } | null | undefined)?.can_use;
    if (typeof canUse !== "boolean") continue;
    const apps = new Set<string>();
    if (typeof requestedApp === "string" && requestedApp) apps.add(requestedApp);
    if (typeof app_key === "string" && app_key) apps.add(app_key);
    for (const app of apps) {
      actionPermissionStore.set(actionPermissionKey(userId, app, action_type, key), {
        canUse,
        expiresAt,
      });
    }
  }
}

/**
 * Deny a run of an action we already KNOW an admin restricted. No I/O: only
 * consults what `recordActionPermissions` saw. Unknown or expired ⇒ allowed.
 */
export function checkKnownActionPermission(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
): { allowed: boolean; reason?: string } {
  const k = actionPermissionKey(userId, appKey, actionType, actionKey);
  const entry = actionPermissionStore.get(k);
  if (!entry) return { allowed: true };
  if (entry.expiresAt <= Date.now()) {
    actionPermissionStore.delete(k);
    return { allowed: true };
  }
  if (entry.canUse) return { allowed: true };
  return {
    allowed: false,
    reason: `The ${appKey} action "${actionKey}" (${actionType}) has been restricted by an admin of this Zapier account, so it can't be run. Ask a Zapier account admin to allow it, or choose a different action.`,
  };
}

/** Test hook: forget every recorded action permission. */
export function clearActionPermissions(): void {
  actionPermissionStore.clear();
}
