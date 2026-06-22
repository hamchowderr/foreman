import { jsonSchema } from "ai";
import { z } from "zod";

/**
 * Makes Foreman's tool input schemas valid for Anthropic's tool-use API
 * (via AI SDK v6), which rejects two JSON-Schema object shapes:
 *
 *   - object-valued additionalProperties → "additionalProperties: object is not
 *     supported. Please set 'additionalProperties' to false"
 *   - omitted additionalProperties      → "additionalProperties must be
 *     explicitly set to false"
 *
 * In other words: EVERY `type:"object"` node in a tool's input schema must have
 * `additionalProperties: false`. That is trivially satisfiable for fixed-shape
 * objects — but several Foreman tools have genuinely DYNAMIC inputs typed as
 * open maps (`z.record`): run-action(inputs), get-action-input-fields-schema(inputs),
 * list-action-input-field-choices(inputs), create/update-table-records(records[].data),
 * create-table-fields(fields[].options/config), run_workflow(inputs),
 * attach_trigger(poll.inputs). The model MUST be free to put arbitrary per-app
 * keys there, so `additionalProperties:false` (which forbids all keys) would
 * break them — yet Anthropic accepts no open-object form at all.
 *
 * The resolution: represent each open map to the MODEL as a JSON **string**
 * (`{type:"string"}` — no object node, no conflict) and transparently
 * `JSON.parse` it back into an object before the tool's original `execute`
 * runs. The tool handler — and the Zapier SDK it forwards to — sees the exact
 * same object it always did; only the model-facing schema changed.
 *
 * This is a single chokepoint applied to the assembled foreman tool map (custom
 * tools + generated SDK tools), so no individual tool or the SDK-tool generator
 * needs to know about it. The revive step is a no-op on non-string values, so
 * it is idempotent and harmless to any other consumer that shares the same
 * (cached) tool object and still passes objects.
 *
 * NOTE: schema acceptance and the parse round-trip are fully verifiable without
 * a live Zapier connection (see tests/unit/tool-schema-sanitizer.test.ts). A
 * true end-to-end run-action against a real connection remains the deploy-time
 * confidence step — it is NOT exercised by the local mocked stack.
 */

/** A runtime path to a field that was rewritten to a JSON string. `"[]"` means
 *  "descend into each element of this array". e.g. ["records","[]","data"]. */
type RevivePath = string[];

const STRING_HINT = 'Pass as a JSON object encoded as a string, e.g. \'{"key":"value"}\'.';

/** Marks tools already processed so a second sanitize pass can't double-wrap. */
const sanitizedTools = new WeakSet<object>();

function isOpenMapNode(node: Record<string, unknown>): boolean {
  if (node.type !== "object") return false;
  const props = node.properties;
  const hasProps = !!props && typeof props === "object" && Object.keys(props as object).length > 0;
  const ap = node.additionalProperties;
  const apIsOpen = ap === true || (!!ap && typeof ap === "object");
  return !hasProps && apIsOpen;
}

/**
 * Walk a JSON schema in place: rewrite open-map object nodes to JSON strings and
 * force `additionalProperties:false` on every remaining object. Returns the
 * runtime paths of the rewritten string fields (for the execute-time revive).
 *
 * `path` is null inside combinators / $defs — those branches are still made
 * schema-valid, but a dynamic map nested there can't be reliably revived by
 * runtime path, so we don't record one (it would surface as a parse error in
 * tests rather than silently mis-executing).
 */
function transformSchema(root: Record<string, unknown>): RevivePath[] {
  const revivePaths: RevivePath[] = [];

  function walk(node: unknown, path: string[] | null): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, path);
      return;
    }
    const obj = node as Record<string, unknown>;

    if (obj.type === "object") {
      if (isOpenMapNode(obj)) {
        const desc = typeof obj.description === "string" ? obj.description : "";
        for (const key of Object.keys(obj)) delete obj[key];
        obj.type = "string";
        obj.description = desc ? `${desc} ${STRING_HINT}` : STRING_HINT;
        if (path) revivePaths.push(path);
        return;
      }
      // Fixed-shape object — close it and recurse into its declared properties.
      obj.additionalProperties = false;
      const props = obj.properties;
      if (props && typeof props === "object") {
        for (const key of Object.keys(props as object)) {
          walk((props as Record<string, unknown>)[key], path ? [...path, key] : null);
        }
      }
    }

    if (obj.type === "array") {
      if (Array.isArray(obj.items)) {
        // Draft-07 tuple form — positional, not simply path-addressable.
        for (const item of obj.items) walk(item, null);
      } else if (obj.items) {
        walk(obj.items, path ? [...path, "[]"] : null);
      }
      // Draft-2020-12 tuple form.
      if (Array.isArray(obj.prefixItems)) {
        for (const item of obj.prefixItems) walk(item, null);
      }
    }

    // Combinators and $defs: recurse for schema validity, but these branches are
    // not addressable by a simple runtime path, so don't record revive paths.
    for (const comb of ["anyOf", "allOf", "oneOf"] as const) {
      const branches = obj[comb];
      if (Array.isArray(branches)) for (const b of branches) walk(b, null);
    }
    if (obj.$defs && typeof obj.$defs === "object") {
      for (const key of Object.keys(obj.$defs as object)) {
        walk((obj.$defs as Record<string, unknown>)[key], null);
      }
    }
  }

  walk(root, []);
  return revivePaths;
}

/** Parse string values back into objects at the recorded revive paths. */
function reviveAtPath(node: unknown, path: RevivePath, i: number): void {
  if (node === null || typeof node !== "object") return;
  const seg = path[i];

  if (seg === "[]") {
    if (Array.isArray(node)) {
      for (const el of node) reviveAtPath(el, path, i + 1);
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  if (i === path.length - 1) {
    const value = obj[seg];
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed === "") {
      delete obj[seg];
      return;
    }
    try {
      obj[seg] = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Tool input field "${seg}" must be a valid JSON object string: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return;
  }
  reviveAtPath(obj[seg], path, i + 1);
}

export function reviveDynamicInputs(input: unknown, paths: RevivePath[]): void {
  for (const path of paths) reviveAtPath(input, path, 0);
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
 * Rewrite each tool's input schema to be Anthropic-valid and wrap its `execute`
 * to revive JSON-string fields back into objects. Mutates the tools in place
 * (and returns the same map). Tools whose schema can't be resolved are left
 * untouched. Idempotent: a tool is processed at most once.
 */
export function sanitizeToolSchemas<T extends Record<string, unknown>>(tools: T): T {
  for (const tool of Object.values(tools)) {
    if (!tool || typeof tool !== "object") continue;
    if (sanitizedTools.has(tool)) continue;

    const t = tool as {
      inputSchema?: unknown;
      execute?: (...args: unknown[]) => unknown;
      strict?: boolean;
    };

    const js = toJsonSchema(t.inputSchema);
    if (!js) {
      sanitizedTools.add(tool);
      continue;
    }

    const revivePaths = transformSchema(js);
    t.inputSchema = jsonSchema(js);
    // We hand-close the schema (additionalProperties:false everywhere); a
    // non-strict tool with an explicit closed schema is exactly what Anthropic
    // wants, and it avoids the strict-grammar limits Anthropic enforces.
    t.strict = false;

    if (revivePaths.length > 0 && typeof t.execute === "function") {
      const original = t.execute;
      // Async wrapper so a revive failure (malformed JSON from the model)
      // surfaces as a rejected promise, the same way Mastra awaits execute.
      t.execute = async (input: unknown, ...rest: unknown[]) => {
        reviveDynamicInputs(input, revivePaths);
        return (original as (...a: unknown[]) => unknown).call(tool, input, ...rest);
      };
    }

    sanitizedTools.add(tool);
  }
  return tools;
}
