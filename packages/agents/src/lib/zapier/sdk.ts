import { createZapierSdk } from "@zapier/zapier-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decryptToken, encryptToken } from "../crypto";
import { getEnv } from "../env";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";

type ZapierSdk = ReturnType<typeof createZapierSdk>;

const sdkCache = new Map<string, { sdk: ZapierSdk; expiresAt: number }>();
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

// Self-hosted mode: single shared SDK instance for all users
let sharedSdkCache: { sdk: ZapierSdk; expiresAt: number } | undefined;

async function getSharedSdk(): Promise<ZapierSdk> {
  if (sharedSdkCache && sharedSdkCache.expiresAt > Date.now()) {
    return sharedSdkCache.sdk;
  }

  const env = getEnv();
  if (!env.ZAPIER_CLIENT_ID || !env.ZAPIER_CLIENT_SECRET) {
    throw new Error(
      "self_hosted mode requires ZAPIER_CLIENT_ID and ZAPIER_CLIENT_SECRET env vars"
    );
  }

  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.ZAPIER_CLIENT_ID,
      client_secret: env.ZAPIER_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to obtain shared Zapier token: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresIn = data.expires_in || 3600;
  const sdk = createZapierSdk({ credentials: data.access_token });

  sharedSdkCache = {
    sdk,
    expiresAt: Date.now() + Math.min(expiresIn * 1000, 5 * 60 * 1000),
  };

  return sdk;
}

async function refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const env = getEnv();
  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.ZAPIER_CLIENT_ID || "",
      client_secret: env.ZAPIER_CLIENT_SECRET || "",
    }),
  });

  if (!res.ok) {
    throw new ZapierReauthRequired(userId, "refresh token rejected");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresIn = data.expires_in || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

export async function getSdkForUser(userId: string, orgId?: string): Promise<ZapierSdk> {
  const env = getEnv();

  // DEV_ZAPIER_OVERRIDE: use a direct token for local development
  if (env.DEV_ZAPIER_OVERRIDE) {
    return createZapierSdk({
      credentials: env.DEV_ZAPIER_OVERRIDE,
    });
  }

  // Self-hosted mode: single shared Zapier account for all users
  if (env.FOREMAN_MODE === "self_hosted") {
    return getSharedSdk();
  }

  // Cache key includes orgId so org and personal connections are cached separately
  const cacheKey = orgId ? `${userId}:org:${orgId}` : userId;

  // Check cache
  const cached = sdkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sdk;
  }

  // Load from database — when orgId is set, try shared org connection first
  type IdentityRow = typeof schema.zapierIdentity.$inferSelect;
  const db = getDb();
  let identity: IdentityRow | undefined;

  if (orgId) {
    const orgRows = await db
      .select()
      .from(schema.zapierIdentity)
      .where(eq(schema.zapierIdentity.orgId, orgId))
      .limit(1);
    identity = orgRows[0];
  }

  // Fall back to user's personal connection
  if (!identity) {
    const userRows = await db
      .select()
      .from(schema.zapierIdentity)
      .where(eq(schema.zapierIdentity.userId, userId))
      .limit(1);
    identity = userRows[0];
  }

  if (!identity) {
    // Dev fallback: use CLI login credentials (~/.zapier-sdk/config.json)
    if (env.FOREMAN_MODE !== "production") {
      return createZapierSdk();
    }
    throw new ZapierNotConnected(userId);
  }

  let accessToken: string;
  let tokenExpiry: number;

  // Refresh if expired
  if (identity.expiresAt && identity.expiresAt.getTime() < Date.now()) {
    try {
      const storedRefresh = decryptToken(identity.refreshToken);
      const refreshed = await refreshAccessToken(userId, storedRefresh);

      // Update DB with new tokens
      await db
        .update(schema.zapierIdentity)
        .set({
          accessToken: encryptToken(refreshed.accessToken),
          refreshToken: encryptToken(refreshed.refreshToken),
          expiresAt: refreshed.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.zapierIdentity.userId, userId));

      accessToken = refreshed.accessToken;
      tokenExpiry = refreshed.expiresAt.getTime();
    } catch {
      // Clear cache on refresh failure
      sdkCache.delete(userId);
      throw new ZapierReauthRequired(userId, "token refresh failed");
    }
  } else {
    accessToken = decryptToken(identity.accessToken);
    tokenExpiry = identity.expiresAt
      ? identity.expiresAt.getTime()
      : Date.now() + 5 * 60 * 1000;
  }

  const sdk = createZapierSdk({
    credentials: accessToken,
  });

  // Cache for 5 minutes or until token expires, whichever is sooner
  const fiveMinutes = Date.now() + 5 * 60 * 1000;
  sdkCache.set(cacheKey, {
    sdk,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return sdk;
}
