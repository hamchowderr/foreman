import { createZapierSdk } from "@zapier/zapier-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decryptToken, encryptToken } from "../crypto";
import { getEnv } from "../env";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";

type ZapierSdk = ReturnType<typeof createZapierSdk>;

const sdkCache = new Map<string, { sdk: ZapierSdk; expiresAt: number }>();
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

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

export async function getSdkForUser(userId: string): Promise<ZapierSdk> {
  const env = getEnv();

  // DEV_ZAPIER_OVERRIDE: use a direct token for local development
  if (env.DEV_ZAPIER_OVERRIDE) {
    return createZapierSdk({
      credentials: env.DEV_ZAPIER_OVERRIDE,
    });
  }

  // Check cache
  const cached = sdkCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sdk;
  }

  // Load from database
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.zapierIdentity)
    .where(eq(schema.zapierIdentity.userId, userId))
    .limit(1);

  const identity = rows[0];
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
  sdkCache.set(userId, {
    sdk,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return sdk;
}
