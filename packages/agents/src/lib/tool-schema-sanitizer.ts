import { jsonSchema } from "ai";
import { z } from "zod";

/**
 * WIP (foreman-2aj0) — partial. Neutralizes one half of an Anthropic tool-schema
 * incompatibility, but does NOT fully fix tool-calling on its own. See the
 * findings at the bottom before extending.
 *
 * Anthropic's tool-use API (via AI SDK v6) requires every JSON-Schema `object`
 * in a tool's input_schema to have `additionalProperties: false`:
 *   - object-valued additionalProperties → "additionalProperties: object is not
 *     supported. Please set 'additionalProperties' to false"
 *   - omitted additionalProperties      → "additionalProperties must be
 *     explicitly set to false"
 *
 * This walker handles the first case (strips object-valued additionalProperties
 * from tool input schemas at assembly time — a single chokepoint for custom +
 * generated SDK tools). It is NOT a complete fix:
 *
 *   THE UNRESOLVED TENSION: several tools have genuinely dynamic inputs typed as
 *   open records — run-action(inputs), get-input-fields-schema(inputs),
 *   list-input-field-choices(inputs), create/update-table-records(records.data),
 *   create-table-fields(fields.options/config), run_workflow(inputs),
 *   attach_trigger(poll.inputs). The model MUST be free to put arbitrary per-app
 *   keys there. Anthropic demands additionalProperties:false, which would forbid
 *   exactly those keys and break run-action (Foreman's core capability).
 *
 *   So neither "omit" nor "set false" is correct for those fields. The real fix
 *   is to retype dynamic inputs as a JSON string the tool parses (no object
 *   schema → no conflict), or a Mastra/AI-SDK version-level fix — EITHER WAY
 *   verified against a live run-action with a real Zapier connection.
 */

function stripOpenAdditionalProps(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) stripOpenAdditionalProps(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (
    obj.type === "object" &&
    obj.additionalProperties &&
    typeof obj.additionalProperties === "object"
  ) {
    delete obj.additionalProperties;
  }
  for (const key of Object.keys(obj)) stripOpenAdditionalProps(obj[key]);
}

function toJsonSchema(schema: unknown): Record<string, unknown> | null {
  if (!schema || typeof schema !== "object") return null;
  const s = schema as Record<string, unknown>;
  // Already an AI SDK Schema (from jsonSchema()) — has a `.jsonSchema` property.
  if (s.jsonSchema && typeof s.jsonSchema === "object") {
    return structuredClone(s.jsonSchema) as Record<string, unknown>;
  }
  // Zod v4 schema — native JSON Schema export.
  try {
    return z.toJSONSchema(schema as Parameters<typeof z.toJSONSchema>[0]) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

/**
 * Rewrite each tool's input schema to neutralize object-valued
 * `additionalProperties` (mutates the tools in place; returns the same map).
 * Tools whose schema can't be resolved are left untouched.
 */
export function sanitizeToolSchemas<T extends Record<string, unknown>>(tools: T): T {
  for (const tool of Object.values(tools)) {
    if (!tool || typeof tool !== "object") continue;
    const t = tool as { inputSchema?: unknown };
    const js = toJsonSchema(t.inputSchema);
    if (!js) continue;
    stripOpenAdditionalProps(js);
    t.inputSchema = jsonSchema(js);
  }
  return tools;
}
