import { createZapierSdk } from "@zapier/zapier-sdk";
import { createZapierSdk as createExperimentalSdk } from "@zapier/zapier-sdk/experimental";
import { decryptToken, encryptToken } from "../crypto";
import { getSupabase } from "../db";
import type { Database } from "../db/database.types";
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

type ZapierSdkOptions = NonNullable<Parameters<typeof createZapierSdk>[0]>;

/**
 * Request-tracing ids for one call (SDK 0.105.0). See `resolveTraceIds` in
 * lib/request-user-context.ts for what each carries.
 */
export interface SdkTraceIds {
  correlationId?: string;
  causationId?: string;
}

/**
 * A cached per-user client plus the resolved options it was built from. The
 * options (token, connection-alias manifest) are what's expensive — DB reads,
 * decrypt, maybe a token refresh — so they're what the cache really holds.
 */
interface CachedSdk<T> {
  sdk: T;
  options: ZapierSdkOptions;
  expiresAt: number;
}

const sdkCache = new Map<string, CachedSdk<ZapierSdk>>();
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

type ZapierSdkFactory<T> = (options?: Parameters<typeof createZapierSdk>[0]) => T;

function hasTrace(trace?: SdkTraceIds): trace is SdkTraceIds {
  return Boolean(trace?.correlationId || trace?.causationId);
}

/** Options with the per-call trace ids layered on (unset ids are omitted). */
export function withTraceOptions(options: ZapierSdkOptions, trace?: SdkTraceIds): ZapierSdkOptions {
  return {
    ...options,
    ...(trace?.correlationId ? { correlationId: trace.correlationId } : {}),
    ...(trace?.causationId ? { causationId: trace.causationId } : {}),
  };
}

type ZapierIdentityRow = Database["public"]["Tables"]["zapier_identity"]["Row"];

/**
 * The Zapier account a user's calls run on, per their workspace's connection mode
 * (workspace_settings.zapier_connection_mode): their own connection, the
 * workspace's designated shared one (usually owned by another member), or either
 * (member-first). An explicit orgId picks the governing workspace; otherwise it's
 * the user's active workspace. Returns null when nothing resolves.
 *
 * The row's `user_id` is the account's OWNER — connection aliases follow it, since
 * a connection id only means something inside the Zapier account that owns it.
 */
export async function resolveZapierIdentity(
  userId: string,
  orgId?: string,
): Promise<ZapierIdentityRow | null> {
  // Resolve the workspace whose policy governs this user (an explicit orgId wins;
  // otherwise the user's active workspace), then that workspace's connection mode.
  const supabase = getSupabase();
  const workspaceId = orgId ?? (await resolveActiveWorkspace(userId)) ?? undefined;
  const mode: ConnectionMode = workspaceId
    ? await resolveWorkspaceConnectionMode(workspaceId)
    : "personal";

  // The loaders RETURN the row rather than mutating a captured `identity` — TS
  // can't track assignments made inside a closure, so the old mutate-in-closure
  // form left `identity` un-narrowable (it collapsed to `never` after the
  // `if (!identity)` guards). Returning keeps the data flow visible to CFA.

  // The member's own connection. Retry briefly: right after the OAuth callback
  // writes zapier_identity (e.g. the onboarding "test" step), the row can lag,
  // which would otherwise look like "not connected". An existing row resolves on
  // the first attempt, so there's no added latency once a user is connected.
  const loadPersonal = async (retry: boolean): Promise<ZapierIdentityRow | null> => {
    const attempts = retry ? 3 : 1;
    let found: ZapierIdentityRow | null = null;
    for (let attempt = 0; attempt < attempts && !found; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
      const { data } = await supabase
        .from("zapier_identity")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      found = data;
    }
    return found;
  };

  // The workspace's designated shared connection (a zapier_identity tagged with
  // this workspace_id — typically owned by another member).
  const loadShared = async (): Promise<ZapierIdentityRow | null> => {
    if (!workspaceId) return null;
    const { data } = await supabase
      .from("zapier_identity")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();
    return data;
  };

  let identity: ZapierIdentityRow | null = null;

  if (mode === "personal") {
    identity = await loadPersonal(true);
  } else if (mode === "shared") {
    identity = await loadShared();
  } else {
    // member-first: own connection, then the workspace's shared one. Only retry
    // the personal lookup (for OAuth lag) once nothing else resolved, so members
    // who rely on the shared connection don't pay the backoff on every call.
    identity = await loadPersonal(false);
    if (!identity) identity = await loadShared();
    if (!identity) identity = await loadPersonal(true);
  }

  return identity;
}

/**
 * Shared per-user client builder. The stable and experimental SDK factories take
 * the same options and differ only in the surface they expose, so both run
 * through one token + connection-alias resolution path (and one refresh) here —
 * each with its own cache. Don't duplicate this logic per factory.
 *
 * TRACING (correlationId / causationId, SDK 0.105.0): these are client-level
 * options, but they vary per conversation / per approval. They are deliberately
 * NOT part of the cache key. The cache holds the user's resolved auth (token +
 * alias manifest) keyed on who the user is; keying it on a conversation id would
 * re-run the DB lookups and token resolution on the first call of every
 * conversation and grow the map by one entry per conversation (entries are only
 * evicted when re-read after expiry). Instead, a traced call gets a lightweight
 * per-call client built from the CACHED options plus the trace ids — client
 * construction is a few ms of in-process wiring with no I/O, and the untraced
 * cached client is untouched.
 */
async function buildSdkForUser<T>(
  factory: ZapierSdkFactory<T>,
  cache: Map<string, CachedSdk<T>>,
  userId: string,
  orgId?: string,
  trace?: SdkTraceIds,
): Promise<T> {
  const env = getEnv();

  // DEV_ZAPIER_OVERRIDE: use a direct token for local development
  if (env.DEV_ZAPIER_OVERRIDE) {
    return factory(
      withTraceOptions({ credentials: env.DEV_ZAPIER_OVERRIDE, onEvent: onZapierSdkEvent }, trace),
    );
  }

  // Cache key includes orgId so org and personal connections are cached separately.
  // Trace ids are intentionally excluded — see the TRACING note above.
  const cacheKey = orgId ? `${userId}:org:${orgId}` : userId;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return hasTrace(trace) ? factory(withTraceOptions(cached.options, trace)) : cached.sdk;
  }

  const identity = await resolveZapierIdentity(userId, orgId);
  const supabase = getSupabase();

  if (!identity) {
    // Dev fallback: use CLI login credentials (~/.zapier-sdk/config.json).
    // production and self_hosted both require a real per-user OAuth connection.
    if (env.FOREMAN_MODE === "dev") {
      return factory(withTraceOptions({ onEvent: onZapierSdkEvent }, trace));
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
      cache.delete(cacheKey);
      throw new ZapierReauthRequired(userId, "token refresh failed");
    }
  } else {
    accessToken = decryptToken(identity.access_token);
    tokenExpiry = expiresAtMs ?? Date.now() + 5 * 60 * 1000;
  }

  // Aliases follow the account the call runs on: a shared connection uses its
  // owner's aliases, never the member's own (their ids belong to another account).
  const connectionsMap = await loadUserConnectionsMap(identity.user_id);
  const hasConnections = Object.keys(connectionsMap).length > 0;

  const options: ZapierSdkOptions = {
    credentials: accessToken,
    ...(hasConnections ? { manifest: { connections: connectionsMap } } : {}),
    onEvent: onZapierSdkEvent,
  };
  const sdk = factory(options);

  // Cache for 5 minutes or until token expires, whichever is sooner
  const fiveMinutes = Date.now() + 5 * 60 * 1000;
  cache.set(cacheKey, {
    sdk,
    options,
    expiresAt: Math.min(fiveMinutes, tokenExpiry),
  });

  return hasTrace(trace) ? factory(withTraceOptions(options, trace)) : sdk;
}

/**
 * Per-user STABLE SDK client — action execution, discovery, tables. The default
 * surface used by the generated Zapier tools.
 *
 * Pass `trace` to stamp `zapier-correlation-id` / `zapier-causation-id` on this
 * call's requests; the returned client is then a per-call one built from the
 * cached auth (see the TRACING note on `buildSdkForUser`).
 */
export function getSdkForUser(
  userId: string,
  orgId?: string,
  trace?: SdkTraceIds,
): Promise<ZapierSdk> {
  return buildSdkForUser(createZapierSdk, sdkCache, userId, orgId, trace);
}

export type ExperimentalZapierSdk = ReturnType<typeof createExperimentalSdk>;

const experimentalSdkCache = new Map<string, CachedSdk<ExperimentalZapierSdk>>();

/**
 * Per-user EXPERIMENTAL SDK client — adds the durable-workflow + trigger-inbox
 * surface (createWorkflow / publishWorkflowVersion / runDurable / triggerWorkflow,
 * ensureTriggerInbox / lease / ack). Same token + connection-alias resolution as
 * the stable client, cached separately. The durable rebuild (foreman-l7xq) is
 * built entirely on this — see lib/durable + lib/trigger-inbox.
 */
export function getExperimentalSdkForUser(
  userId: string,
  orgId?: string,
): Promise<ExperimentalZapierSdk> {
  return buildSdkForUser(createExperimentalSdk, experimentalSdkCache, userId, orgId);
}
