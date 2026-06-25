import { createZapierSdk } from "@zapier/zapier-sdk";
import { decryptToken, encryptToken } from "../crypto";
import { getSupabase } from "../db";
import { getEnv } from "../env";
import { resolveActiveWorkspace } from "../identity";
import { loadUserConnectionsMap } from "./aliases";
import { onZapierSdkEvent } from "./deprecation";
import { ZapierNotConnected, ZapierReauthRequired } from "./errors";

/**
 * How a workspace member's Zapier connection is resolved (workspace_settings
 * .zapier_connection_mode). Absent setting ⇒ "member-first".
 */
type ConnectionMode = "member-first" | "shared" | "personal";

async function resolveWorkspaceConnectionMode(workspaceId: string): Promise<ConnectionMode> {
  const { data } = await getSupabase()
    .from("workspace_settings")
    .select("zapier_connection_mode")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const mode = data?.zapier_connection_mode;
  return mode === "shared" || mode === "personal" ? mode : "member-first";
}

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
      onEvent: onZapierSdkEvent,
    });
  }

  // Cache key includes orgId so org and personal connections are cached separately
  const cacheKey = orgId ? `${userId}:org:${orgId}` : userId;

  // Check cache
  const cached = sdkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sdk;
  }

  // Resolve the workspace whose policy governs this user (an explicit orgId wins;
  // otherwise the user's active workspace), then that workspace's connection mode.
  const supabase = getSupabase();
  const workspaceId = orgId ?? (await resolveActiveWorkspace(userId)) ?? undefined;
  const mode: ConnectionMode = workspaceId
    ? await resolveWorkspaceConnectionMode(workspaceId)
    : "personal";

  let identity: Record<string, any> | null = null;

  // The member's own connection. Retry briefly: right after the OAuth callback
  // writes zapier_identity (e.g. the onboarding "test" step), the row can lag,
  // which would otherwise look like "not connected". An existing row resolves on
  // the first attempt, so there's no added latency once a user is connected.
  const loadPersonal = async (retry: boolean) => {
    const attempts = retry ? 3 : 1;
    for (let attempt = 0; attempt < attempts && !identity; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
      const { data } = await supabase
        .from("zapier_identity")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      identity = data;
    }
  };

  // The workspace's designated shared connection (a zapier_identity tagged with
  // this workspace_id — typically owned by another member).
  const loadShared = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("zapier_identity")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();
    identity = data;
  };

  if (mode === "personal") {
    await loadPersonal(true);
  } else if (mode === "shared") {
    await loadShared();
  } else {
    // member-first: own connection, then the workspace's shared one. Only retry
    // the personal lookup (for OAuth lag) once nothing else resolved, so members
    // who rely on the shared connection don't pay the backoff on every call.
    await loadPersonal(false);
    if (!identity) await loadShared();
    if (!identity) await loadPersonal(true);
  }

  if (!identity) {
    // Dev fallback: use CLI login credentials (~/.zapier-sdk/config.json).
    // production and self_hosted both require a real per-user OAuth connection.
    if (env.FOREMAN_MODE === "dev") {
      return createZapierSdk({ onEvent: onZapierSdkEvent });
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

      // Update the resolved row by its own id — it may be a shared connection
      // owned by another member, so scoping by the requesting user_id would miss.
      await supabase
        .from("zapier_identity")
        .update({
          access_token: encryptToken(refreshed.accessToken),
          refresh_token: encryptToken(refreshed.refreshToken),
          expires_at: refreshed.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", identity.id);

      accessToken = refreshed.accessToken;
      tokenExpiry = refreshed.expiresAt.getTime();
    } catch {
      sdkCache.delete(cacheKey);
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
    onEvent: onZapierSdkEvent,
  });

  // Cache for 5 minutes or until token expires, whichever is sooner
  const fiveMinutes = Date.now() + 5 * 60 * 1000;
  sdkCache.set(cacheKey, {
    sdk,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return sdk;
}
