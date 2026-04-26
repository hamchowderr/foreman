import { createZapierSdk } from "@zapier/zapier-sdk";
import { getSupabase } from "../db";
import { decryptToken, encryptToken } from "../crypto";
import { getEnv } from "../env";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";
import { loadUserConnectionsMap } from "./aliases";

type ZapierSdk = ReturnType<typeof createZapierSdk>;

const sdkCache = new Map<string, { sdk: ZapierSdk; expiresAt: number }>();
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

// Self-hosted mode: single shared SDK instance for all users.
// The SDK handles token exchange + refresh internally via client_credentials.
let sharedSdk: ZapierSdk | undefined;

function getSharedSdk(): ZapierSdk {
  if (sharedSdk) return sharedSdk;

  const env = getEnv();
  if (!env.ZAPIER_CLIENT_ID || !env.ZAPIER_CLIENT_SECRET) {
    throw new Error(
      "self_hosted mode requires ZAPIER_CLIENT_ID and ZAPIER_CLIENT_SECRET env vars"
    );
  }

  sharedSdk = createZapierSdk({
    credentials: {
      clientId: env.ZAPIER_CLIENT_ID,
      clientSecret: env.ZAPIER_CLIENT_SECRET,
    },
  });

  return sharedSdk;
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
  const supabase = getSupabase();
  let identity: Record<string, any> | null = null;

  if (orgId) {
    const { data } = await supabase
      .from("zapier_identity")
      .select("*")
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    identity = data;
  }

  // Fall back to user's personal connection
  if (!identity) {
    const { data } = await supabase
      .from("zapier_identity")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    identity = data;
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
  const expiresAtMs = identity.expires_at ? new Date(identity.expires_at).getTime() : null;
  if (expiresAtMs && expiresAtMs < Date.now()) {
    try {
      const storedRefresh = decryptToken(identity.refresh_token);
      const refreshed = await refreshAccessToken(userId, storedRefresh);

      // Update DB with new tokens
      await supabase
        .from("zapier_identity")
        .update({
          access_token: encryptToken(refreshed.accessToken),
          refresh_token: encryptToken(refreshed.refreshToken),
          expires_at: refreshed.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      accessToken = refreshed.accessToken;
      tokenExpiry = refreshed.expiresAt.getTime();
    } catch {
      // Clear cache on refresh failure
      sdkCache.delete(userId);
      throw new ZapierReauthRequired(userId, "token refresh failed");
    }
  } else {
    accessToken = decryptToken(identity.access_token);
    tokenExpiry = expiresAtMs ?? Date.now() + 5 * 60 * 1000;
  }

  const connectionsMap = await loadUserConnectionsMap(userId);
  const hasConnections = Object.keys(connectionsMap).length > 0;

  const sdk = createZapierSdk({
    credentials: accessToken,
    ...(hasConnections ? { manifest: { connections: connectionsMap } } : {}),
  });

  // Cache for 5 minutes or until token expires, whichever is sooner
  const fiveMinutes = Date.now() + 5 * 60 * 1000;
  sdkCache.set(cacheKey, {
    sdk,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return sdk;
}
