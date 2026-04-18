import { Hono } from "hono";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";
import {
  checkRateLimit,
  SENSITIVE_APP_CATEGORIES,
  checkAppAccess,
} from "@/lib/guardrails";
import { getOrgGuardrailConfig } from "@/lib/guardrails-config";
import { setCapability } from "@/lib/capabilities";
import { validateParam } from "@/lib/validation";

const guardrails = new Hono<AppEnv>();

// All routes require auth
guardrails.use("/*", authMiddleware);

// GET /status — current user's guardrail state
guardrails.get("/status", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const config = getOrgGuardrailConfig(orgId);

  // Check rate limit remaining (peek without recording)
  const rateCheck = await checkRateLimit(userId, {
    perMinute: config.rateLimitPerMinute,
    perHour: config.rateLimitPerHour,
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
    config: {
      requireApprovalForWrites: config.requireApprovalForWrites,
      maxBulkItems: config.maxBulkItems,
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
    return c.json(
      { error: `${appKey} is not a sensitive app. No access toggle needed.` },
      400
    );
  }

  // Set the capability flag for the entire category
  await setCapability(userId, `app:${category}`, body.enabled);

  return c.json({
    appKey,
    category,
    enabled: body.enabled,
  });
});

export default guardrails;
