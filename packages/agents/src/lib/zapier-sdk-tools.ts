import { createTool } from "@mastra/core/tools";
import {
  createZapierSdk,
  ZapierError,
  ZapierAuthenticationError,
  ZapierRateLimitError,
  ZapierNotFoundError,
  ZapierAppNotFoundError,
  ZapierResourceNotFoundError,
  ZapierActionError,
  ZapierTimeoutError,
  ZapierRelayError,
  ZapierValidationError,
  ZapierConfigurationError,
} from "@zapier/zapier-sdk";
import { z } from "zod";

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
  "listInputFields",
  "listInputFieldChoices",
  "listTables",
  "getTable",
  "listTableFields",
  "listTableRecords",
  "getTableRecord",
  "listClientCredentials",
  "getProfile",
]);

/**
 * Deprecated SDK methods that are thin wrappers around other methods.
 * Excluded to avoid duplicate tools confusing the agent.
 */
const DEPRECATED_METHODS = new Set([
  "listAuthentications",
  "findFirstAuthentication",
  "findUniqueAuthentication",
  "getAuthentication",
  "request",
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
  "listClientCredentials",
  "listTables",
  "listTableRecords",
  "listTableFields",
  "listInputFields",
  "listInputFieldChoices",
  "runAction", // search/read actions return paginated results
]);

/** Default max items to collect when auto-paginating. */
const DEFAULT_MAX_ITEMS = 100;

/**
 * Generate all Zapier SDK tools as Mastra createTool() instances.
 *
 * @param credentials - Optional credentials for the SDK. If not provided,
 *   the SDK reads from ZAPIER_CREDENTIALS env var or CLI login.
 * @returns Record of tool-name → Tool instances
 */
export function generateZapierTools(credentials?: string | (() => Promise<string>)) {
  const isDebug = process.env.FOREMAN_MODE === "dev" || process.env.DEBUG === "true";
  const sdk = createZapierSdk({
    ...(credentials ? { credentials } : {}),
    debug: isDebug,
    maxNetworkRetries: 3,
    maxNetworkRetryDelayMs: 30000,
    canDeleteTables: true, // Gated by requireApproval on the tool
  });

  const registry = sdk.getRegistry({ package: "mcp" });
  const tools: Record<string, ReturnType<typeof createTool>> = {};

  for (const fn of registry.functions) {
    if (DEPRECATED_METHODS.has(fn.name)) continue;

    const toolName = toKebab(fn.name);
    const description =
      fn.description ||
      fn.inputSchema?.description ||
      `Execute ${fn.name}`;

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
      const sdkFn = (sdk as any)[fn.name] as (args: any) => Promise<any>;

      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: fn.inputSchema as unknown as z.ZodObject<any>,
        ...(isDestructive ? { requireApproval: true } : {}),
        ...mcpAnnotations,
        toModelOutput: createSummarizer(fn.name),
        execute: async (input) => {
          try {
            if (PAGINATED_METHODS.has(fn.name)) {
              const maxItems = (input as any).maxItems ?? DEFAULT_MAX_ITEMS;
              const result = await sdkFn.call(sdk, { ...input, maxItems });
              if (result?.data && Array.isArray(result.data)) {
                return { data: result.data, count: result.data.length, nextCursor: result.nextCursor };
              }
              return result;
            }
            return await sdkFn.call(sdk, input);
          } catch (err) {
            return handleSdkError(err, fn.name);
          }
        },
      });
    } else if (fn.inputParameters) {
      // Positional-params function (fetch)
      const sdkFn = (sdk as any)[fn.name] as (...args: any[]) => Promise<any>;

      // Build a Zod schema from input parameters.
      // fetch has url (required) and init (optional).
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const param of fn.inputParameters) {
        // url is always required for fetch; init is optional
        const isRequired = param.name === "url";
        if (isRequired) {
          shape[param.name] = z.any().describe((param as any).description || param.name);
        } else {
          shape[param.name] = z.any().optional().describe((param as any).description || param.name);
        }
      }

      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: z.object(shape).describe(description),
        ...(isDestructive ? { requireApproval: true } : {}),
        ...mcpAnnotations,
        toModelOutput: createSummarizer(fn.name),
        execute: async (input) => {
          try {
            const args = fn.inputParameters!.map((p: any) => input[p.name]);
            return await sdkFn.call(sdk, ...args);
          } catch (err) {
            return handleSdkError(err, fn.name);
          }
        },
      });
    }
  }

  return tools;
}

/**
 * Create a per-user SDK tool set with dynamic credentials.
 * Used for multi-tenant scenarios.
 */
export function generateUserZapierTools(credentials: string) {
  return generateZapierTools(credentials);
}

/**
 * Handle SDK errors using instanceof checks against the SDK's typed error classes.
 * Returns structured error objects so the agent can explain errors to users.
 */
function handleSdkError(err: unknown, methodName: string): { error: string; code: string; retryable: boolean; suggestedRecovery?: { action: string; appKey: string | null } } {
  // Use instanceof for type-safe error handling against the SDK's error hierarchy
  if (err instanceof ZapierAuthenticationError) {
    const ae = err as any;
    const appKey = ae.appKey ?? ae.app ?? null;
    return {
      error: `Zapier authentication failed for ${methodName}${appKey ? ` (app: ${appKey})` : ""}. The connection is likely expired. Suggest the user reconnect — call list-connections with \`is-expired: true\` to confirm, then use connect_zapier${appKey ? ` with slug "${appKey}"` : ""} to generate a fresh connect URL.`,
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
    const detail = ae.actionErrors
      ? JSON.stringify(ae.actionErrors)
      : ae.message;
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
          id, name, title, key, app, appKey, slug, status, type, actionType,
          ...rest
        } = item;
        const summary: Record<string, unknown> = {};
        if (id) summary.id = id;
        if (name) summary.name = name;
        if (title) summary.title = title;
        if (key) summary.key = key;
        if (app) summary.app = app;
        if (appKey) summary.appKey = appKey;
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
    return obj.length > maxLen ? obj.slice(0, maxLen) + "..." : obj;
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
