import { createZapierSdk } from "@zapier/zapier-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decryptToken } from "../crypto";
import { getEnv } from "../env";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";

type ZapierSdk = ReturnType<typeof createZapierSdk>;

const sdkCache = new Map<string, { sdk: ZapierSdk; expiresAt: number }>();

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
    throw new ZapierNotConnected(userId);
  }

  // Check expiry
  if (identity.expiresAt && identity.expiresAt.getTime() < Date.now()) {
    throw new ZapierReauthRequired(userId, "access token expired");
  }

  const accessToken = decryptToken(identity.accessToken);

  const sdk = createZapierSdk({
    credentials: accessToken,
  });

  // Cache for 5 minutes or until token expires, whichever is sooner
  const fiveMinutes = Date.now() + 5 * 60 * 1000;
  const tokenExpiry = identity.expiresAt
    ? identity.expiresAt.getTime()
    : fiveMinutes;
  sdkCache.set(userId, {
    sdk,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return sdk;
}
