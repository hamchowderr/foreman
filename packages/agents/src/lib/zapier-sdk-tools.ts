import { createTool } from "@mastra/core/tools";
import {
  createZapierSdk,
  ZapierActionError,
  ZapierAppNotFoundError,
  ZapierApprovalError,
  ZapierAuthenticationError,
  ZapierConfigurationError,
  ZapierError,
  ZapierNotFoundError,
  ZapierRateLimitError,
  ZapierRelayError,
  ZapierResourceNotFoundError,
  ZapierTimeoutError,
  ZapierValidationError,
} from "@zapier/zapier-sdk";
import { z } from "zod";
import { requestUserContext } from "./request-user-context";
import { getSdkForUser } from "./zapier/sdk";

/**
 * Auto-generate Mastra tools from the Zapier SDK's internal registry.
 *
 * This replaces the MCP stdio approach — instead of spawning `npx zapier-sdk mcp`
 * as a child process, we import the SDK directly and generate tools from its
 * registry. This makes the agent server deployable to Vercel (no child processes).
 *
 * The SDK's getRegistry() returns the same function list the MCP server uses
 * internally — we're just cutting out the MCP transport layer.
 *
 * NOTE: The SDK also exposes an ergonomic "app proxy" — `zapier.apps[appKey][actionType][actionKey]({...})`
 * with optional connection binding (`zapier.apps[appKey]({ connection })`).
 * We don't use it here: the agent picks tools by name/schema at runtime, so the
 * runAction shape (app/actionType/action as string fields) is easier for an LLM
 * to fill than a chained property path. If we later hand-write workflow steps
 * that always target the same action (e.g., `sheets.write.add_row(...)`), the
 * app proxy is the right pattern — use it there, not here.
 */

/** Tools that execute real actions and should require user approval. */
const APPROVAL_REQUIRED = new Set([
  "runAction",
  "fetch",
  "createTable",
  "deleteTable",
  "createTableRecords",
  "updateTableRecords",
  "deleteTableRecords",
  "createTableFields",
  "deleteTableFields",
]);

/** Read-only tools — used for MCP annotations. */
const READ_ONLY = new Set([
  "listApps",
  "getApp",
  "listActions",
  "getAction",
  "listConnections",
  "findFirstConnection",
  "findUniqueConnection",
  "getConnection",
  "getInputFieldsSchema",
  "listInputFieldChoices",
  "listTables",
  "getTable",
  "listTableFields",
  "listTableRecords",
  "getTableRecord",
  "getProfile",
]);

/**
 * SDK methods excluded from tool generation.
 *
 * Two reasons to exclude:
 * 1. Deprecated wrappers — duplicates of other SDK methods that would confuse
 *    the agent if both were exposed.
 * 2. Unused for Foreman — features Foreman doesn't surface to users (e.g.,
 *    Connect Builder OAuth client-credential management).
 */
const EXCLUDED_METHODS = new Set([
  // Deprecated — duplicates of `connection`-prefixed methods
  "listAuthentications",
  "findFirstAuthentication",
  "findUniqueAuthentication",
  "getAuthentication",
  "request",
  // Legacy duplicate of getInputFieldsSchema
  "listInputFields",
  // Connect Builder OAuth client credentials — Foreman doesn't expose this
  "createClientCredentials",
  "deleteClientCredentials",
  "listClientCredentials",
]);

/** Convert camelCase to kebab-case (matching MCP server convention). */
function toKebab(name: string): string {
  return name.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * List methods that return paginated results.
 * We pass maxItems to the SDK so it auto-paginates up to the cap.
 */
const PAGINATED_METHODS = new Set([
  "listActions",
  "listApps",
  "listConnections",
  "listTables",
  "listTableRecords",
  "listTableFields",
  "listInputFieldChoices",
  "runAction", // search/read actions return paginated results
]);

/** Default max items to collect when auto-paginating. */
const DEFAULT_MAX_ITEMS = 100;

/**
 * Resolve SDK credentials based on environment.
 * - Explicit credentials passed in: use as-is (per-user token from PKCE flow).
 * - Dev mode + no credentials: SDK auto-uses CLI login (~/.zapier-sdk/config.json).
 * - Production + no credentials: Client Credentials from ZAPIER_CLIENT_ID/SECRET.
 */
function resolveCredentials(
  explicit?: string | (() => Promise<string>),
): Parameters<typeof createZapierSdk>[0]["credentials"] {
  if (explicit) return explicit;
  const isDev = process.env.FOREMAN_MODE === "dev";
  if (!isDev) {
    const clientId = process.env.ZAPIER_CLIENT_ID;
    const clientSecret = process.env.ZAPIER_CLIENT_SECRET;
    if (clientId && clientSecret) return { clientId, clientSecret };
  }
  return undefined; // dev: SDK uses CLI login
}

/**
 * Module-level cache for the default tool set.
 *
 * `createZapierSdk()` mutates global state (the zod `_zod` symbol registry —
 * multiple zod copies share state via this symbol). When that mutation happens
 * BEFORE `new Mastra({...})` has constructed, Mastra Studio's internal
 * `toJSONSchema` introspection enters an infinite loop instead of throwing.
 * Result: `mastra dev` hangs at `[file-logger] Logging to server.log`.
 *
 * Callers should resolve tools lazily — i.e., from a Mastra `DynamicArgument`
 * function (`tools: () => ...`) which only fires at request time, after
 * `new Mastra(...)` has finished constructing. This cache makes that pattern
 * cheap: the first request pays the SDK-init cost; subsequent requests reuse
 * the same tool instances.
 *
 * Per-user tool sets (with explicit credentials/connections) are NOT cached —
 * they're always rebuilt for the requesting user.
 */
let _defaultToolsCache: Record<string, ReturnType<typeof createTool>> | undefined;

/**
 * Generate all Zapier SDK tools as Mastra createTool() instances.
 *
 * Use this when you need per-user credentials or connections. If you don't —
 * (i.e. dev CLI login or env-var-only creds) — prefer `getDefaultZapierTools()`,
 * which memoizes the result so three agents don't each re-init the SDK.
 *
 * @param credentials - Optional per-user token (from PKCE web OAuth). If omitted,
 *   dev mode uses CLI login; production uses ZAPIER_CLIENT_ID/SECRET env vars.
 *   When omitted (the agent-default path), the result is memoized.
 * @param connections - Optional pre-seeded connection alias map.
 * @returns Record of tool-name → Tool instances
 */
export function generateZapierTools(
  credentials?: string | (() => Promise<string>),
  connections?: Record<string, { connectionId: number }>,
) {
  if (!credentials && !connections && _defaultToolsCache) {
    return _defaultToolsCache;
  }
  const isDebug = process.env.FOREMAN_MODE === "dev" || process.env.DEBUG === "true";
  const hasConnections = connections && Object.keys(connections).length > 0;
  const resolvedCredentials = resolveCredentials(credentials);
  const sdk = createZapierSdk({
    ...(resolvedCredentials ? { credentials: resolvedCredentials } : {}),
    ...(hasConnections ? { manifest: { connections } } : {}),
    debug: isDebug,
    maxNetworkRetries: 3,
    maxNetworkRetryDelayMs: 30000,
    canDeleteTables: true,
  });

  const registry = sdk.getRegistry({ package: "mcp" });
  const tools: Record<string, ReturnType<typeof createTool>> = {};

  for (const fn of registry.functions) {
    if (EXCLUDED_METHODS.has(fn.name)) continue;

    const toolName = toKebab(fn.name);
    const description = fn.description || fn.inputSchema?.description || `Execute ${fn.name}`;

    const isReadOnly = READ_ONLY.has(fn.name);
    const isDestructive = APPROVAL_REQUIRED.has(fn.name);

    const mcpAnnotations = {
      mcp: {
        annotations: {
          readOnlyHint: isReadOnly,
          destructiveHint: isDestructive,
          openWorldHint: true,
        },
      },
    };

    if (fn.inputSchema) {
      const _sdkFn = (sdk as any)[fn.name] as (args: any) => Promise<any>;

      // Some SDK schemas (e.g. getProfile) come pre-wrapped in z.optional().
      // Unwrap before handing to Mastra — otherwise Mastra wraps again and
      // zod v4's toJSONSchema rejects optional-of-optional as non-representable.
      const raw = fn.inputSchema as unknown as z.ZodTypeAny;
      const unwrapped =
        (raw as any)?._zod?.def?.type === "optional" ? (raw as any)._zod.def.innerType : raw;

      const summarize = createSummarizer(fn.name);
      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: unwrapped as unknown as z.ZodObject<any>,
        ...(isDestructive ? { requireApproval: true } : {}),
        ...mcpAnnotations,
        execute: async (input) => {
          try {
            // Resolve per-user SDK if a user context is active (set by request handler).
            // Falls back to the global SDK (CLI login / client credentials) when no
            // user context is available — e.g., during channel webhook processing.
            const userCtx = requestUserContext.getStore();
            const activeSdk = userCtx?.userId ? await getSdkForUser(userCtx.userId) : sdk;
            const activeMethod = (activeSdk as any)[fn.name] as (args: any) => Promise<any>;

            if (PAGINATED_METHODS.has(fn.name)) {
              const maxItems = (input as any).maxItems ?? DEFAULT_MAX_ITEMS;
              const result = await activeMethod.call(activeSdk, { ...input, maxItems });
              return summarize(result);
            }
            return summarize(await activeMethod.call(activeSdk, input));
          } catch (err) {
            return handleSdkError(err, fn.name);
          }
        },
      });
    } else if (fn.inputParameters) {
      // Positional-params function (fetch)
      const _sdkFn = (sdk as any)[fn.name] as (...args: any[]) => Promise<any>;

      // Build a Zod schema from input parameters.
      // fetch has url (required) and init (optional).
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const param of fn.inputParameters) {
        // url is always required for fetch; init is optional
        const isRequired = param.name === "url";
        if (isRequired) {
          shape[param.name] = z.any().describe((param as any).description || param.name);
        } else {
          shape[param.name] = z
            .any()
            .optional()
            .describe((param as any).description || param.name);
        }
      }

      const summarizeFetch = createSummarizer(fn.name);
      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: z.object(shape).describe(description),
        ...(isDestructive ? { requireApproval: true } : {}),
        ...mcpAnnotations,
        execute: async (input) => {
          try {
            const userCtx = requestUserContext.getStore();
            const activeSdk = userCtx?.userId ? await getSdkForUser(userCtx.userId) : sdk;
            const activeMethod = (activeSdk as any)[fn.name] as (...args: any[]) => Promise<any>;
            const args = fn.inputParameters!.map((p: any) => input[p.name]);
            return summarizeFetch(await activeMethod.call(activeSdk, ...args));
          } catch (err) {
            return handleSdkError(err, fn.name);
          }
        },
      });
    }
  }

  if (!credentials && !connections) {
    _defaultToolsCache = tools;
  }
  return tools;
}

/**
 * Create a per-user SDK tool set with dynamic credentials and pre-seeded
 * connection aliases. Used for multi-tenant scenarios.
 *
 * @param credentials - User's Zapier access token
 * @param connections - Optional alias map from connection_alias table
 */
export function generateUserZapierTools(
  credentials: string,
  connections?: Record<string, { connectionId: number }>,
) {
  return generateZapierTools(credentials, connections);
}

/**
 * Memoized default tool set — uses CLI login (dev) or env-var creds (production).
 * Build once, share across every agent that doesn't need per-user credentials.
 */
let _defaultTools: ReturnType<typeof generateZapierTools> | undefined;
export function getDefaultZapierTools() {
  if (!_defaultTools) _defaultTools = generateZapierTools();
  return _defaultTools;
}

/**
 * Handle SDK errors using instanceof checks against the SDK's typed error classes.
 * Returns structured error objects so the agent can explain errors to users.
 */
export function handleSdkError(
  err: unknown,
  methodName: string,
): {
  error: string;
  code: string;
  retryable: boolean;
  suggestedRecovery?: { action: string; appKey: string | null };
} {
  // Use instanceof for type-safe error handling against the SDK's error hierarchy
  if (err instanceof ZapierAuthenticationError) {
    const ae = err as any;
    const appKey = ae.appKey ?? ae.app ?? null;
    return {
      error: `Zapier authentication failed for ${methodName}${appKey ? ` (app: ${appKey})` : ""}. The connection is likely expired. Suggest the user reconnect — call list-connections with \`isExpired: true\` to confirm, then use connect_zapier${appKey ? ` with slug "${appKey}"` : ""} to generate a fresh connect URL.`,
      code: "AUTH_FAILED",
      retryable: false,
      suggestedRecovery: {
        action: "reconnect",
        appKey,
      },
    };
  }

  if (err instanceof ZapierRateLimitError) {
    return {
      error: `Zapier rate limit hit for ${methodName}. Try again in a moment.`,
      code: "RATE_LIMITED",
      retryable: true,
    };
  }

  if (err instanceof ZapierTimeoutError) {
    return {
      error: `${methodName} timed out. The request may still be processing — try again.`,
      code: "TIMEOUT",
      retryable: true,
    };
  }

  if (err instanceof ZapierRelayError) {
    return {
      error: `Zapier infrastructure error for ${methodName}. Try again in a moment.`,
      code: "RELAY_ERROR",
      retryable: true,
    };
  }

  if (err instanceof ZapierActionError) {
    const ae = err as any;
    const detail = ae.actionErrors ? JSON.stringify(ae.actionErrors) : ae.message;
    return {
      error: `Action failed (${ae.appKey ?? "unknown"}/${ae.actionKey ?? "unknown"}): ${detail}`,
      code: "ACTION_FAILED",
      retryable: false,
    };
  }

  if (err instanceof ZapierAppNotFoundError) {
    const anfe = err as any;
    return {
      error: `App not found: "${anfe.appKey ?? "unknown"}". Check the app key with list-apps.`,
      code: "APP_NOT_FOUND",
      retryable: false,
    };
  }

  if (err instanceof ZapierResourceNotFoundError) {
    const rnfe = err as any;
    return {
      error: `${rnfe.resourceType ?? "Resource"} not found (ID: ${rnfe.resourceId ?? "unknown"}).`,
      code: "NOT_FOUND",
      retryable: false,
    };
  }

  if (err instanceof ZapierNotFoundError) {
    return {
      error: `Resource not found for ${methodName}: ${(err as Error).message}`,
      code: "NOT_FOUND",
      retryable: false,
    };
  }

  if (err instanceof ZapierValidationError) {
    return {
      error: `Invalid input for ${methodName}: ${(err as Error).message}`,
      code: "VALIDATION_ERROR",
      retryable: false,
    };
  }

  if (err instanceof ZapierConfigurationError) {
    return {
      error: `Configuration error for ${methodName}: ${(err as Error).message}`,
      code: "CONFIG_ERROR",
      retryable: false,
    };
  }

  // Surface Zapier's own approval flow. In a server / non-TTY context, runAction
  // defaults approvalMode to "throw", so an action awaiting human approval throws
  // ZapierApprovalError carrying a URL the user must open to approve it on Zapier's
  // side. Must precede the generic ZapierError catch-all (it extends ZapierError),
  // or the approval URL is silently lost.
  if (err instanceof ZapierApprovalError) {
    const ae = err as ZapierApprovalError;
    return {
      error: ae.approvalUrl
        ? `${methodName} needs your approval on Zapier before it can run. Open this link to approve, then try again: ${ae.approvalUrl}`
        : `${methodName} needs approval on Zapier before it can run (status: ${ae.approvalStatus ?? "pending"}). No approval URL was returned — try again shortly.`,
      code: "APPROVAL_REQUIRED",
      retryable: false,
    };
  }

  // Catch-all for any ZapierError subclass we didn't handle
  if (err instanceof ZapierError) {
    return {
      error: `${methodName} failed: ${(err as Error).message}`,
      code: (err as any).code ?? "SDK_ERROR",
      retryable: false,
    };
  }

  // Non-SDK errors (network, etc.)
  const message = err instanceof Error ? err.message : String(err);
  return { error: `${methodName} failed: ${message}`, code: "UNKNOWN_ERROR", retryable: false };
}

/**
 * Summarize tool results to reduce context usage.
 */
function createSummarizer(fnName: string) {
  return (output: unknown): unknown => {
    if (!output || typeof output !== "object") return output;

    const data = (output as any).data ?? output;
    const result = (output as any).result ?? data;

    // For list operations, summarize count + key fields
    if (Array.isArray(result)) {
      const items = result.slice(0, 20);
      const summarized = items.map((item: any) => {
        if (typeof item !== "object" || !item) return item;
        const {
          id,
          name,
          title,
          key,
          app,
          appKey,
          app_name,
          app_key,
          account_type,
          slug,
          status,
          type,
          actionType,
          ...rest
        } = item;
        const summary: Record<string, unknown> = {};
        if (id) summary.id = id;
        if (name) summary.name = name;
        if (title) summary.title = title;
        if (key) summary.key = key;
        if (app) summary.app = app;
        if (appKey) summary.appKey = appKey;
        if (app_name) summary.app_name = app_name;
        if (app_key) summary.app_key = app_key;
        if (account_type) summary.account_type = account_type;
        if (slug) summary.slug = slug;
        if (status) summary.status = status;
        if (type) summary.type = type;
        if (actionType) summary.actionType = actionType;
        const extraKeys = Object.keys(rest);
        if (extraKeys.length <= 3) {
          Object.assign(summary, rest);
        } else {
          summary._extraFields = extraKeys.length;
        }
        return summary;
      });
      const response: Record<string, unknown> = {
        items: summarized,
        count: result.length,
      };
      if (result.length > 20) response.truncated = true;
      if ((output as any).nextCursor) response.nextCursor = (output as any).nextCursor;
      return response;
    }

    // For run-action results, keep the full result
    if (fnName === "runAction") return output;

    // For single-item responses, trim long strings
    if (typeof result === "object" && result !== null) {
      return trimDeep(result, 500);
    }

    return output;
  };
}

function trimDeep(obj: any, maxLen: number): any {
  if (typeof obj === "string") {
    return obj.length > maxLen ? `${obj.slice(0, maxLen)}...` : obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 30).map((v) => trimDeep(v, maxLen));
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = trimDeep(v, maxLen);
    }
    return result;
  }
  return obj;
}
