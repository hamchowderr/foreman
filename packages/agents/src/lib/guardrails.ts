import { checkCapability } from "./capabilities";

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
  limits?: { perMinute?: number; perHour?: number }
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const perMinute = limits?.perMinute ?? 30;
  const perHour = limits?.perHour ?? 200;
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

  // Record this action
  counters.minute.push(now);
  counters.hour.push(now);

  return { allowed: true };
}

// ─── Action Risk Assessment ───

export interface ActionRisk {
  level: "low" | "medium" | "high" | "critical";
  reason: string;
  requiresConfirmation: boolean;
}

const MESSAGING_APPS = new Set([
  "gmail",
  "outlook",
  "sendgrid",
  "mailchimp",
  "twilio",
  "slack",
  "discord",
  "telegram",
  "intercom",
  "hubspot",
  "mailgun",
  "postmark",
]);

export function assessActionRisk(
  actionType: string,
  actionKey: string,
  inputs: Record<string, unknown>
): ActionRisk {
  const keyLower = actionKey.toLowerCase();

  // Any action with "delete" in the key = critical
  if (keyLower.includes("delete")) {
    return {
      level: "critical",
      reason: `Destructive action: ${actionKey}`,
      requiresConfirmation: true,
    };
  }

  // raw_api calls = high
  if (actionType === "raw_api" || actionType === "run") {
    return {
      level: "high",
      reason: `Raw API / run action: ${actionKey}`,
      requiresConfirmation: true,
    };
  }

  // Write actions need more scrutiny
  if (
    actionType === "write" ||
    actionType === "search_and_write" ||
    actionType === "search_or_write"
  ) {
    // Check for bulk operations (arrays > 10 items)
    for (const value of Object.values(inputs)) {
      if (Array.isArray(value) && value.length > 10) {
        return {
          level: "high",
          reason: `Bulk write: ${actionKey} with ${value.length} items`,
          requiresConfirmation: true,
        };
      }
    }

    // Write to messaging/email apps = medium
    // We extract the app from actionKey (format: "AppName.action_name")
    const appPart = actionKey.split(".")[0]?.toLowerCase() ?? "";
    if (MESSAGING_APPS.has(appPart)) {
      return {
        level: "medium",
        reason: `Write to messaging app: ${actionKey}`,
        requiresConfirmation: true,
      };
    }

    // Generic write = medium (no extra confirmation beyond existing approval)
    return {
      level: "medium",
      reason: `Write action: ${actionKey}`,
      requiresConfirmation: false,
    };
  }

  // search/read = low
  return {
    level: "low",
    reason: `Read/search action: ${actionKey}`,
    requiresConfirmation: false,
  };
}

// ─── Sensitive App Access ───

export const SENSITIVE_APP_CATEGORIES: Record<string, string[]> = {
  banking: ["stripe", "paypal", "square", "plaid", "wise"],
  hr: ["bamboohr", "gusto", "rippling", "workday", "adp"],
  security: ["okta", "auth0", "onepassword"],
};

/** Flat set of all sensitive app keys for fast lookup. */
const SENSITIVE_APPS = new Set(
  Object.values(SENSITIVE_APP_CATEGORIES).flat()
);

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
  appKey: string
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
  const enabled = await checkCapability(userId, capKey);

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
async function checkSensitiveAppCapability(
  userId: string,
  capability: string
): Promise<boolean> {
  // We use the same DB table but interpret "no row" as disabled
  const { eq, and } = await import("drizzle-orm");
  const { getDb, schema } = await import("./db");

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.capabilityFlag)
    .where(
      and(
        eq(schema.capabilityFlag.userId, userId),
        eq(schema.capabilityFlag.capability, capability)
      )
    )
    .limit(1);

  const flag = rows[0];
  // No row = disabled (opt-in for sensitive apps)
  if (!flag) return false;
  return flag.enabled;
}

// ─── Bulk Confirmation ───

export function needsBulkConfirmation(
  inputs: Record<string, unknown>,
  threshold?: number
): boolean {
  const max = threshold ?? 5;
  for (const value of Object.values(inputs)) {
    if (Array.isArray(value) && value.length > max) {
      return true;
    }
  }
  return false;
}

// ─── Combined Guardrail Check ───

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  risk?: ActionRisk;
  requiresConfirmation: boolean;
}

export async function runGuardrails(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
  inputs: Record<string, unknown>
): Promise<GuardrailResult> {
  // 1. Rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)}s.`,
      requiresConfirmation: false,
    };
  }

  // 2. App access (sensitive app blocking)
  const appCheck = await checkAppAccess(userId, appKey);
  if (!appCheck.allowed) {
    return {
      allowed: false,
      reason: appCheck.reason,
      requiresConfirmation: false,
    };
  }

  // 3. Action risk assessment
  const risk = assessActionRisk(actionType, actionKey, inputs);

  // 4. Bulk confirmation
  const bulk = needsBulkConfirmation(inputs);

  return {
    allowed: true,
    risk,
    requiresConfirmation: risk.requiresConfirmation || bulk,
  };
}
