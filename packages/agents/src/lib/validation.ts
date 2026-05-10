import type { Context } from "hono";
import { z } from "zod";

// Reusable schemas
export const idSchema = z.string().uuid().or(z.string().min(1).max(100));
export const contentSchema = z.string().min(1).max(50000); // 50KB max
export const textSchema = z.string().min(1).max(10000); // 10KB max for voice

// Safe JSON parser that returns 400 instead of crashing
export async function parseJsonBody<T>(c: Context, schema: z.ZodSchema<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }
  return result.data;
}

// Type guard: check if parseJsonBody returned a Response (validation error)
export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

// Validate URL params
export function validateParam(value: string | undefined, _name: string): string | null {
  if (!value || value.length === 0 || value.length > 200) return null;
  return value;
}
