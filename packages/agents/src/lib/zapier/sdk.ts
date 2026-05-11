import { createZapierSdk } from "@zapier/zapier-sdk";
import { decryptToken, encryptToken } from "../crypto";
import { getSupabase } from "../db";
import { getEnv } from "../env";
import { loadUserConnectionsMap } from "./aliases";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";

// Must match the client ID used during the PKCE OAuth flow in connect.ts.
// Tokens issued to a PKCE public client can only be refreshed with the same client_id and no secret.
const ZAPIER_PKCE_CLIENT_ID = "grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6";

type ZapierSdk = ReturnType<typeof createZapierSdk>;

const sdkCache = new Map<string, { sdk: ZapierSdk; expiresAt: number }>();
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

async function refreshAccessToken(
  userId: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ZAPIER_PKCE_CLIENT_ID,
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

  // Cache key includes orgId so org and personal connections are cached separately
  const cacheKey = orgId ? `${userId}:org:${orgId}` : userId;

  // Check cache
  const cached = sdkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sdk;
  }

  // Load from database — when workspaceId is set, try shared workspace connection first
  const supabase = getSupabase();
  let identity: Record<string, any> | null = null;

  if (orgId) {
    const { data } = await supabase
      .from("zapier_identity")
      .select("*")
      .eq("workspace_id", orgId)
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
    // Dev fallback: use CLI login credentials (~/.zapier-sdk/config.json).
    // production and self_hosted both require a real per-user OAuth connection.
    if (env.FOREMAN_MODE === "dev") {
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
