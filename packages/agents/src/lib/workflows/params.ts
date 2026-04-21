/**
 * Mustache-style {{param}} substitution for workflow step templates.
 */

const PARAM_RE = /\{\{(\w+)\}\}/g;

/** Extract all unique parameter names from a template object. */
export function extractParams(template: Record<string, unknown>): string[] {
  const params = new Set<string>();

  function walk(value: unknown): void {
    if (typeof value === "string") {
      for (const match of value.matchAll(PARAM_RE)) {
        params.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else if (value !== null && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  }

  walk(template);
  return [...params];
}

/** Deep-substitute {{param}} placeholders with provided values. */
export function substituteParams(
  template: Record<string, unknown>,
  values: Record<string, string>
): Record<string, unknown> {
  function walk(value: unknown): unknown {
    if (typeof value === "string") {
      return value.replace(PARAM_RE, (full, key) =>
        key in values ? values[key] : full
      );
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  }

  return walk(template) as Record<string, unknown>;
}

/** Validate that all required parameters have been provided. */
export function validateParams(
  template: Record<string, unknown>,
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const required = extractParams(template);
  const missing = required.filter((p) => !(p in values));
  return { valid: missing.length === 0, missing };
}
