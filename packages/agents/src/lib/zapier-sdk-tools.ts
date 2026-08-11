import { createTool } from "@mastra/core/tools";
import {
  createZapierSdk,
  ZapierActionError,
  ZapierApiError,
  ZapierAppNotFoundError,
  ZapierApprovalError,
  ZapierAuthenticationError,
  ZapierBundleError,
  ZapierConfigurationError,
  ZapierConflictError,
  ZapierError,
  ZapierNotFoundError,
  ZapierRateLimitError,
  ZapierRelayError,
  ZapierResourceNotFoundError,
  ZapierTimeoutError,
  ZapierUnknownError,
  ZapierValidationError,
} from "@zapier/zapier-sdk";
import { z } from "zod";
import { requestUserContext } from "./request-user-context";
import { onZapierSdkEvent } from "./zapier/deprecation";
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
  // Non-blocking half of `runAction` (SDK 0.94.0). It starts a real action run
  // and returns immediately instead of waiting — same blast radius as
  // `runAction`, so it gates the same way. Not waiting for the result does not
  // make it safe.
  "createActionRun",
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
  "getActionInputFieldsSchema",
  "listActionInputFields",
  "listActionInputFieldChoices",
  "listTables",
  "getTable",
  "listTableFields",
  "listTableRecords",
  "getTableRecord",
  "getProfile",
  // Point-in-time read of an action run's state (SDK 0.94.0). Reports a still
  // -running run as `status: "waiting"` and a failed one as `status: "error"`
  // rather than throwing; the caller polls. Executes nothing itself.
  "getActionRun",
  // Trigger discovery — the trigger-side mirror of the action discovery reads
  // above, and needed for the same reason: the agent has to be able to see what
  // a trigger accepts to build an automation against it (foreman-eadn).
  "listTriggers",
  "getTriggerInputFieldsSchema",
  "listTriggerInputFields",
  "listTriggerInputFieldChoices",
  // Trigger-inbox reads. Inspecting an inbox and its queued messages is safe;
  // the state-changing half of this surface is excluded below.
  "listTriggerInboxes",
  "getTriggerInbox",
  "listTriggerInboxMessages",
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
  // Deprecated input-field aliases — canonical surfaced instead:
  // getActionInputFieldsSchema / listActionInputFields / listActionInputFieldChoices
  "listInputFields",
  "getInputFieldsSchema",
  "listInputFieldChoices",
  // Connect Builder OAuth client credentials — Foreman doesn't expose this
  "createClientCredentials",
  "deleteClientCredentials",
  "listClientCredentials",
  // In-flow connection helpers (added to the main mcp registry in SDK 0.71).
  // Excluded from auto-generation for two reasons:
  //   1. `createConnection` / `waitForNewConnection` BLOCK up to 5 minutes
  //      waiting for the user to finish connecting — wrong for Mastra's
  //      synchronous tool loop (would stall a request/stream).
  //   2. Foreman already owns the connection UX via the `connect_zapier`
  //      custom tool + the `/zapier/*` OAuth callback route; exposing these
  //      would give the agent competing, overlapping ways to connect an app.
  // Deliberate adoption of `createConnection` (as a proper async/background
  // custom tool) is tracked in foreman-mcwn.
  "createConnection",
  "getConnectionStartUrl",
  "waitForNewConnection",
  // Trigger-inbox lifecycle + message delivery (foreman-eadn). Excluded for the
  // same reason as the connection helpers: Foreman already owns this surface
  // internally. `lib/trigger-inbox/` drives it by calling the SDK directly
  // (`opts.sdk.ensureTriggerInbox` / `.leaseTriggerInboxMessages` / …), NOT
  // through these generated tools, so excluding them costs the worker nothing.
  //
  // Exposing them would be actively harmful rather than merely redundant:
  // lease/ack/release ARE the worker's at-least-once delivery guarantee, and an
  // agent acking a message the worker has not processed drops that trigger for
  // good. Gating them behind approval was the other option and is worse — these
  // run on every worker tick, so the prompts would be constant and meaningless.
  "createTriggerInbox",
  "ensureTriggerInbox",
  "updateTriggerInbox",
  "deleteTriggerInbox",
  "pauseTriggerInbox",
  "resumeTriggerInbox",
  "leaseTriggerInboxMessages",
  "ackTriggerInboxMessages",
  "releaseTriggerInboxMessages",
]);

/**
 * The three classification sets, exported so a test can assert the invariant
 * that every method in the SDK's mcp registry lands in exactly one of them.
 *
 * That guard is the point. Tool generation fails OPEN: an unclassified method
 * is not skipped (only EXCLUDED_METHODS skips) and gets no `requireApproval`
 * (only APPROVAL_REQUIRED sets it), so forgetting to classify a method silently
 * ships it as a no-approval agent tool. Sixteen `trigger*` methods drifted in
 * exactly that way across several SDK bumps before anyone noticed (foreman-eadn).
 */
export const METHOD_CLASSIFICATION = {
  APPROVAL_REQUIRED,
  READ_ONLY,
  EXCLUDED_METHODS,
} as const;

/** Convert camelCase to kebab-case (matching MCP server convention). */
function toKebab(name: string): string {
  return name.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Tool IDs (kebab-case) of the read-only Zapier tools — the safe, no-approval
 * reads. Used to opt them into Mastra background execution at the AGENT level
 * (foreman-7am4): tool-level `background` config doesn't dispatch under Foreman's
 * lazy `tools: () => …` resolver, but the agent-level `backgroundTasks.tools`
 * map does. Write/destructive tools are intentionally excluded (stay synchronous
 * so the proposal/approval flow is undisturbed). Computed from static metadata —
 * no SDK init, safe to import at module load.
 */
export const READ_ONLY_TOOL_IDS: string[] = Array.from(READ_ONLY, toKebab);

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
  "listActionInputFieldChoices",
  "runAction", // search/read actions return paginated results
]);

/** Default max items to collect when auto-paginating. */
const DEFAULT_MAX_ITEMS = 100;

/**
 * Stringified-open-object coercion (the nested-in-array gap).
 *
 * A few Zapier tools take an "open bag" param — dynamic keys, `additionalProperties`
 * — *nested inside an array*: table-record `data`, table-field `options`/`config`.
 * Models (weak ones reliably, strong ones sometimes) emit such a bag as a JSON
 * *string*. Mastra's built-in coercion (`coerceStringifiedJsonValues`) only fixes
 * TOP-LEVEL bags, not ones nested in an array, so these fail validation before the
 * tool runs.
 *
 * We override just these tools' input schemas — rebuilt in *our* zod so the
 * field-level coercion actually runs during Mastra's `~standard` validation. (A
 * `z.preprocess` wrapper around the SDK's own schema gets bypassed because it
 * crosses zod copies.) The model-facing JSON schema is unchanged: the bag still
 * advertises as an `object`; we just also accept and parse the stringified form.
 */
const jsonObjectParam = (desc: string) =>
  z.preprocess((v: unknown) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v; // leave as-is; validation surfaces the real problem
      }
    }
    return v;
  }, z.record(z.string(), z.any()).describe(desc));

const SCHEMA_OVERRIDES: Record<string, z.ZodTypeAny> = {
  createTableRecords: z.object({
    table: z.string().describe("The unique identifier of the table"),
    records: z
      .array(
        z.object({
          data: jsonObjectParam("Field values for the record, keyed by field name or id"),
        }),
      )
      .min(1)
      .describe("Records to create (max 100)"),
    keyMode: z
      .enum(["names", "ids"])
      .optional()
      .describe('How to interpret field keys: "names" (default, human-readable) or "ids"'),
  }),
  updateTableRecords: z.object({
    table: z.string().describe("The unique identifier of the table"),
    records: z
      .array(
        z.object({
          id: z.string().describe("The record id to update"),
          data: jsonObjectParam("Updated field values, keyed by field name or id"),
        }),
      )
      .min(1)
      .describe("Records to update"),
    keyMode: z.enum(["names", "ids"]).optional(),
  }),
  createTableFields: z.object({
    table: z.string().describe("The unique identifier of the table"),
    fields: z
      .array(
        z.object({
          name: z.string().describe("Field (column) name"),
          type: z.string().describe("Field type, e.g. string, number, date, email, bool"),
          options: jsonObjectParam("Optional field options (type-specific)").optional(),
          config: jsonObjectParam("Optional field config (type-specific)").optional(),
        }),
      )
      .min(1)
      .describe("Fields (columns) to create"),
  }),
};

/**
 * Resolve SDK credentials based on environment.
 * - Explicit credentials passed in: use as-is (per-user token from PKCE flow).
 * - Dev mode + no credentials: SDK auto-uses CLI login (~/.zapier-sdk/config.json).
 * - Production + no credentials: Client Credentials from ZAPIER_CLIENT_ID/SECRET.
 */
function resolveCredentials(
  explicit?: string | (() => Promise<string>),
): NonNullable<Parameters<typeof createZapierSdk>[0]>["credentials"] {
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
    maxNetworkRetryDelaySeconds: 30,
    canDeleteTables: true,
    onEvent: onZapierSdkEvent,
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
        inputSchema: (SCHEMA_OVERRIDES[fn.name] ?? unwrapped) as unknown as z.ZodObject<any>,
        ...(isDestructive ? { requireApproval: true } : {}),
        ...mcpAnnotations,
        execute: async (input) => {
          try {
            // Resolve per-user SDK if a user context is active (set by request handler).
            // Falls back to the global SDK (CLI login / client credentials) when no
            // user context is available — e.g., during channel webhook processing.
            const userCtx = requestUserContext.getStore();
            const activeSdk = userCtx?.userId ? await getSdkForUser(userCtx.userId) : sdk;
            const activeMethod = (activeSdk as any)[fn.name] as (...args: any[]) => Promise<any>;

            // Positional-projection methods (only `fetch` today) take SPREAD
            // arguments, not the canonical single bag — the surface is
            // `(...args) => canonicalValue(pack(args))`, so handing it one
            // object binds that whole object to the first positional key.
            // SDK 0.86 replaced the old `inputParameters` metadata (objects
            // carrying `.name`) with `positional`: an ordered list of input
            // KEYS to project onto arguments. Every registry entry now also
            // has an `inputSchema`, so this can no longer be a sibling branch.
            if (fn.positional) {
              const args = fn.positional.map((key) => (input as any)[key]);
              return summarize(await activeMethod.call(activeSdk, ...args));
            }

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

  // Conflicting state (409) — e.g. creating a named resource that already
  // exists, or acting on a resource in an incompatible state. Actionable:
  // tell the user what conflicted so they can rename / pick another.
  if (err instanceof ZapierConflictError) {
    const ce = err as ZapierConflictError;
    return {
      error: `${methodName} conflicts with existing state${
        ce.resourceType ? ` (${ce.resourceType})` : ""
      }: ${(err as Error).message}. It may already exist or be in an incompatible state — use a different name or check the current state, then try again.`,
      code: "CONFLICT",
      retryable: false,
    };
  }

  // Generic API-request failure. Base ZapierError carries an optional
  // statusCode; surface it when present. Not retryable by default (unlike
  // rate-limit/timeout/relay, which have their own branches above).
  if (err instanceof ZapierApiError) {
    const ape = err as ZapierApiError;
    return {
      error: `Zapier API error for ${methodName}${
        ape.statusCode ? ` (HTTP ${ape.statusCode})` : ""
      }: ${(err as Error).message}`,
      code: "API_ERROR",
      retryable: false,
    };
  }

  // Code bundling / compilation failure — carries per-error build details.
  if (err instanceof ZapierBundleError) {
    const be = err as ZapierBundleError;
    const detail =
      be.buildErrors && be.buildErrors.length > 0
        ? be.buildErrors.join("; ")
        : (err as Error).message;
    return {
      error: `${methodName} failed to build: ${detail}`,
      code: "BUNDLE_ERROR",
      retryable: false,
    };
  }

  // Fallback the SDK produces for non-Error throws it normalized. No extra
  // structure to extract — surface the message. Must precede the ZapierError
  // catch-all (it extends ZapierError).
  if (err instanceof ZapierUnknownError) {
    return {
      error: `${methodName} failed: ${(err as Error).message}`,
      code: "UNKNOWN_ERROR",
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
