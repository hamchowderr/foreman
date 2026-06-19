/**
 * Unit tests for the tool-schema sanitizer (foreman-2aj0).
 *
 * Verifies — WITHOUT a live Anthropic or Zapier dependency — that:
 *  1. Every object node in the model-facing schema ends up with
 *     additionalProperties:false (the Anthropic tool-use requirement).
 *  2. Open maps (z.record) are rewritten to JSON strings the model can fill.
 *  3. execute transparently revives those strings back into the exact objects
 *     the original handler / Zapier SDK expects (top-level + nested-in-array).
 *  4. The revive is a no-op on non-string values (idempotent + safe for any
 *     other consumer of a shared tool object).
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { reviveDynamicInputs, sanitizeToolSchemas } from "@/lib/tool-schema-sanitizer";
import { generateZapierTools } from "@/lib/zapier-sdk-tools";

/** Pull the raw JSON Schema back out of an AI SDK Schema (jsonSchema()). */
function rawSchema(tool: { inputSchema?: unknown }): Record<string, any> {
  return (tool.inputSchema as any).jsonSchema as Record<string, any>;
}

/** Recursively assert every `type:"object"` node has additionalProperties:false. */
function assertNoOpenObjects(node: any, pathLabel = "$"): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) assertNoOpenObjects(node[i], `${pathLabel}[${i}]`);
    return;
  }
  if (node.type === "object") {
    expect(node.additionalProperties, `${pathLabel}.additionalProperties`).toBe(false);
  }
  for (const key of Object.keys(node)) assertNoOpenObjects(node[key], `${pathLabel}.${key}`);
}

/**
 * Build a tool plus a separate reference to the original execute spy. After
 * sanitize, `tool.execute` is the revive wrapper — assert on `spy` to see what
 * the original handler actually received.
 */
function makeTool(inputSchema: z.ZodTypeAny) {
  const spy = vi.fn((input: unknown) => input);
  const tool: { id: string; inputSchema: z.ZodTypeAny; execute: (...a: any[]) => any } = {
    id: "t",
    inputSchema,
    execute: spy,
  };
  return { tool, spy };
}

describe("sanitizeToolSchemas — schema rewrite", () => {
  it("rewrites a top-level open-map (z.record) input to a JSON string", () => {
    const { tool } = makeTool(
      z.object({
        app: z.string(),
        action: z.string(),
        inputs: z.record(z.string(), z.unknown()),
      }),
    );
    sanitizeToolSchemas({ tool });
    const js = rawSchema(tool);

    expect(js.properties.inputs.type).toBe("string");
    expect(js.properties.app.type).toBe("string");
    expect(js.additionalProperties).toBe(false);
    assertNoOpenObjects(js);
  });

  it("rewrites an open map nested inside an array (records[].data)", () => {
    const { tool } = makeTool(
      z.object({
        table: z.string(),
        records: z.array(z.object({ data: z.record(z.string(), z.unknown()) })),
      }),
    );
    sanitizeToolSchemas({ tool });
    const js = rawSchema(tool);

    expect(js.properties.records.type).toBe("array");
    expect(js.properties.records.items.properties.data.type).toBe("string");
    expect(js.properties.records.items.additionalProperties).toBe(false);
    assertNoOpenObjects(js);
  });

  it("closes a fixed-shape object with additionalProperties:false (no rewrite)", () => {
    const { tool } = makeTool(z.object({ a: z.string(), b: z.number() }));
    sanitizeToolSchemas({ tool });
    const js = rawSchema(tool);

    expect(js.additionalProperties).toBe(false);
    expect(js.properties.a.type).toBe("string");
    assertNoOpenObjects(js);
  });

  it("leaves a tool with an unresolvable schema untouched and never throws", () => {
    const tool = { id: "x", inputSchema: undefined, execute: vi.fn() };
    expect(() => sanitizeToolSchemas({ tool })).not.toThrow();
  });

  it("sets strict:false on the sanitized tool", () => {
    const { tool } = makeTool(z.object({ a: z.string() }));
    (tool as any).strict = true;
    sanitizeToolSchemas({ tool });
    expect((tool as any).strict).toBe(false);
  });
});

describe("sanitizeToolSchemas — execute revive round-trip", () => {
  it("parses a top-level JSON-string field back into the object the handler expects", async () => {
    const { tool, spy } = makeTool(
      z.object({ app: z.string(), inputs: z.record(z.string(), z.unknown()) }),
    );
    sanitizeToolSchemas({ tool });

    await tool.execute({ app: "gmail", inputs: '{"to":"a@b.com","subject":"hi"}' });

    expect(spy).toHaveBeenCalledTimes(1);
    const received = spy.mock.calls[0][0] as any;
    expect(received.inputs).toEqual({ to: "a@b.com", subject: "hi" });
  });

  it("revives open maps nested inside an array, element by element", async () => {
    const { tool, spy } = makeTool(
      z.object({
        records: z.array(z.object({ data: z.record(z.string(), z.unknown()) })),
      }),
    );
    sanitizeToolSchemas({ tool });

    await tool.execute({
      records: [{ data: '{"x":1}' }, { data: '{"y":2}' }],
    });

    const received = spy.mock.calls[0][0] as any;
    expect(received.records[0].data).toEqual({ x: 1 });
    expect(received.records[1].data).toEqual({ y: 2 });
  });

  it("passes non-string values straight through (idempotent / safe for other callers)", async () => {
    const { tool, spy } = makeTool(z.object({ inputs: z.record(z.string(), z.unknown()) }));
    sanitizeToolSchemas({ tool });

    // Another agent that didn't get the string-schema still passes an object.
    await tool.execute({ inputs: { already: "object" } });

    const received = spy.mock.calls[0][0] as any;
    expect(received.inputs).toEqual({ already: "object" });
  });

  it("drops an empty-string dynamic field rather than parsing it", async () => {
    const { tool, spy } = makeTool(
      z.object({ app: z.string(), inputs: z.record(z.string(), z.unknown()) }),
    );
    sanitizeToolSchemas({ tool });

    await tool.execute({ app: "x", inputs: "   " });

    const received = spy.mock.calls[0][0] as any;
    expect("inputs" in received).toBe(false);
  });

  it("throws a clear error when the model supplies malformed JSON", async () => {
    const { tool } = makeTool(z.object({ inputs: z.record(z.string(), z.unknown()) }));
    sanitizeToolSchemas({ tool });

    await expect(tool.execute({ inputs: "{not valid json" })).rejects.toThrow(
      /must be a valid JSON object string/,
    );
  });

  it("does not double-wrap execute when sanitized twice", async () => {
    const { tool, spy } = makeTool(z.object({ inputs: z.record(z.string(), z.unknown()) }));
    sanitizeToolSchemas({ tool });
    sanitizeToolSchemas({ tool }); // second pass must be a no-op

    await tool.execute({ inputs: '{"a":1}' });
    const received = spy.mock.calls[0][0] as any;
    // If double-wrapped, the second revive would try to JSON.parse an object and throw.
    expect(received.inputs).toEqual({ a: 1 });
  });
});

describe("real Foreman SDK tools are Anthropic-valid after sanitize (foreman-2aj0 regression guard)", () => {
  // generateZapierTools() builds from the SDK's static registry — no creds,
  // no network — so this runs in CI exactly like the existing zapier-sdk-tools
  // suite. This is the keyless proof the Anthropic 400 is gone for the REAL
  // always-loaded tools, and it would have caught the original regression.
  const tools = generateZapierTools();

  // The always-loaded tools the original bug report named (run-action poisons
  // every turn because it's core). Some table tools may vary by SDK version.
  const ALWAYS_LOADED_OFFENDERS = [
    "run-action",
    "get-input-fields-schema",
    "list-input-field-choices",
    "create-table-fields",
    "create-table-records",
    "update-table-records",
  ];

  it("generates the offender tools we expect to sanitize", () => {
    expect(tools["run-action"], "run-action must exist (it is always loaded)").toBeDefined();
    for (const name of ALWAYS_LOADED_OFFENDERS) {
      if (tools[name]) expect(tools[name].inputSchema, `${name} inputSchema`).toBeDefined();
    }
  });

  it("leaves no open object in ANY sanitized SDK tool schema", () => {
    // Sanitize the entire generated set — Anthropic reports only the first
    // offending tool per request, so a partial check could hide others.
    sanitizeToolSchemas(tools);
    for (const [name, tool] of Object.entries(tools)) {
      assertNoOpenObjects(rawSchema(tool), name);
    }
  });

  it("rewrites run-action's dynamic `inputs` field to a JSON string", () => {
    sanitizeToolSchemas(tools); // idempotent — already sanitized above
    const js = rawSchema(tools["run-action"]);
    expect(js.properties.inputs.type).toBe("string");
  });
});

describe("reviveDynamicInputs (direct)", () => {
  it("handles top-level and nested-array paths together", () => {
    const input: any = {
      inputs: '{"k":"v"}',
      records: [{ data: '{"n":1}' }],
    };
    reviveDynamicInputs(input, [["inputs"], ["records", "[]", "data"]]);
    expect(input.inputs).toEqual({ k: "v" });
    expect(input.records[0].data).toEqual({ n: 1 });
  });
});
