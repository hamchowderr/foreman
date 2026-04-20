import { createTool } from "@mastra/core/tools";
import { createZapierSdk } from "@zapier/zapier-sdk";
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
 */

/** Tools that execute real actions and should require user approval. */
const APPROVAL_REQUIRED = new Set([
  "runAction",
  "fetch",
  "request",
  "createTable",
  "deleteTable",
  "createTableRecords",
  "updateTableRecords",
  "deleteTableRecords",
  "createTableFields",
  "deleteTableFields",
]);

/** Convert camelCase to kebab-case (matching MCP server convention). */
function toKebab(name: string): string {
  return name.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Generate all Zapier SDK tools as Mastra createTool() instances.
 *
 * @param credentials - Optional credentials for the SDK. If not provided,
 *   the SDK reads from ZAPIER_CREDENTIALS env var or CLI login.
 * @returns Record of tool-name → Tool instances
 */
export function generateZapierTools(credentials?: string | (() => Promise<string>)) {
  const sdk = createZapierSdk(
    credentials ? { credentials } : undefined
  );

  const registry = sdk.getRegistry({ package: "mcp" });
  const tools: Record<string, ReturnType<typeof createTool>> = {};

  for (const fn of registry.functions) {
    const toolName = toKebab(fn.name);
    const description =
      fn.description ||
      fn.inputSchema?.description ||
      `Execute ${fn.name}`;

    if (fn.inputSchema) {
      // Zod-schema based function (33 of 34)
      const sdkFn = (sdk as any)[fn.name] as (args: any) => Promise<any>;

      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: fn.inputSchema as z.ZodObject<any>,
        ...(APPROVAL_REQUIRED.has(fn.name) ? { requireApproval: true } : {}),
        toModelOutput: createSummarizer(fn.name),
        execute: async (input) => {
          const result = await sdkFn.call(sdk, input);
          return result;
        },
      });
    } else if (fn.inputParameters) {
      // Positional-params function (fetch)
      const sdkFn = (sdk as any)[fn.name] as (...args: any[]) => Promise<any>;

      // Build a Zod schema from input parameters
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const param of fn.inputParameters) {
        if (param.required) {
          shape[param.name] = z.any().describe(param.description || param.name);
        } else {
          shape[param.name] = z.any().optional().describe(param.description || param.name);
        }
      }

      tools[toolName] = createTool({
        id: toolName,
        description,
        inputSchema: z.object(shape).describe(description),
        ...(APPROVAL_REQUIRED.has(fn.name) ? { requireApproval: true } : {}),
        toModelOutput: createSummarizer(fn.name),
        execute: async (input) => {
          // Reconstruct positional args from the flat object
          const args = fn.inputParameters!.map((p: any) => input[p.name]);
          const result = await sdkFn.call(sdk, ...args);
          return result;
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
 * Summarize tool results to reduce context usage.
 * Same logic as the MCP toModelOutput transformers.
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
