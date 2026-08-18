import { Hono } from "hono";
import { setCapability } from "../lib/capabilities";
import { getSupabase } from "../lib/db";
import { checkAppAccess, checkRateLimit, SENSITIVE_APP_CATEGORIES } from "../lib/guardrails";
import { getWorkspaceGuardrailConfig, invalidateGuardrailConfig } from "../lib/guardrails-config";
import { resolveActiveWorkspace } from "../lib/identity";
import { validateParam } from "../lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const guardrails = new Hono<AppEnv>();

// All routes require auth
guardrails.use("/*", authMiddleware);

// GET /status — current user's guardrail state
guardrails.get("/status", async (c) => {
  const userId = c.get("userId");
  // Reporting guardrail state must not fail just because the workspace lookup
  // did — fall back to the built-in defaults, which is what enforcement would
  // apply anyway.
  const workspaceId = await resolveActiveWorkspace(userId).catch(() => null);
  const config = await getWorkspaceGuardrailConfig(workspaceId);

  // peek: reading your own remaining budget must not consume it.
  const rateCheck = await checkRateLimit(userId, {
    perMinute: config.rateLimitPerMinute,
    perHour: config.rateLimitPerHour,
    peek: true,
  });

  // Check access for each sensitive app category
  const appAccess: Record<string, { allowed: boolean; apps: string[] }> = {};
  for (const [category, apps] of Object.entries(SENSITIVE_APP_CATEGORIES)) {
    const check = await checkAppAccess(userId, apps[0]);
    appAccess[category] = { allowed: check.allowed, apps };
  }

  return c.json({
    rateLimit: {
      allowed: rateCheck.allowed,
      retryAfterMs: rateCheck.retryAfterMs,
      limits: {
        perMinute: config.rateLimitPerMinute,
        perHour: config.rateLimitPerHour,
      },
    },
    appAccess,
    workspaceId,
    config: {
      maxBulkItems: config.maxBulkItems,
      redactEmails: config.redactEmails,
    },
  });
});

// PUT /app-access/:appKey — toggle sensitive app access
guardrails.put("/app-access/:appKey", async (c) => {
  const userId = c.get("userId");
  const appKey = validateParam(c.req.param("appKey"), "appKey");
  if (!appKey) {
    return c.json({ error: "Invalid appKey" }, 400);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled (boolean) is required" }, 400);
  }

  // Find the category for this app
  const appLower = appKey.toLowerCase();
  let category: string | null = null;
  for (const [cat, apps] of Object.entries(SENSITIVE_APP_CATEGORIES)) {
    if (apps.includes(appLower)) {
      category = cat;
      break;
    }
  }

  if (!category) {
    return c.json({ error: `${appKey} is not a sensitive app. No access toggle needed.` }, 400);
  }

  // Set the capability flag for the entire category
  await setCapability(userId, `app:${category}`, body.enabled);

  return c.json({
    appKey,
    category,
    enabled: body.enabled,
  });
});

/**
 * PUT /settings — workspace admins set guardrail defaults for every member.
 *
 * This is the storage the landing page's "Admin override for orgs" claim was
 * missing (foreman-nz8b): the config used to be a function returning frozen
 * constants. Foreman's tenancy unit is the workspace, so admin-ness is
 * `is_workspace_admin`, not a separate org role.
 *
 * A null value clears the override and returns that field to the built-in
 * default — distinct from 0, which the CHECK constraints reject outright so an
 * admin cannot accidentally disable the limiter.
 */
guardrails.put("/settings", async (c) => {
  const userId = c.get("userId");
  const workspaceId = await resolveActiveWorkspace(userId);
  if (!workspaceId) return c.json({ error: "No active workspace" }, 400);

  const supabase = getSupabase();
  const { data: isAdmin } = await supabase.rpc("is_workspace_admin", {
    user_id: userId,
    workspace_id: workspaceId,
  });
  if (!isAdmin) {
    return c.json({ error: "Only workspace admins can change guardrail settings" }, 403);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const patch: Record<string, number | boolean | null> = {};
  const numeric = [
    ["rateLimitPerMinute", "rate_limit_per_minute"],
    ["rateLimitPerHour", "rate_limit_per_hour"],
    ["maxBulkItems", "max_bulk_items"],
  ] as const;
  for (const [key, column] of numeric) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null) {
      patch[column] = null; // clear the override, fall back to the default
      continue;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      return c.json({ error: `${key} must be a positive integer or null` }, 400);
    }
    patch[column] = value;
  }
  if ("redactEmails" in body) {
    if (typeof body.redactEmails !== "boolean") {
      return c.json({ error: "redactEmails must be a boolean" }, 400);
    }
    patch.redact_emails = body.redactEmails;
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ error: "No recognised settings in body" }, 400);
  }

  const { error } = await supabase
    .from("workspace_settings")
    .upsert({ workspace_id: workspaceId, ...patch }, { onConflict: "workspace_id" });
  if (error) return c.json({ error: error.message }, 500);

  // Enforcement caches the config for 30s; drop it so the change is immediate.
  invalidateGuardrailConfig(workspaceId);

  return c.json({ workspaceId, config: await getWorkspaceGuardrailConfig(workspaceId) });
});

export default guardrails;
