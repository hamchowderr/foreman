import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = "file:./test-auth.db";

// Set env before any imports that need it
beforeAll(async () => {
  // Clean up any previous test DB
  try {
    fs.unlinkSync("test-auth.db");
  } catch {}

  process.env.DATABASE_URL = TEST_DB;
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  // Apply migrations manually
  const client = createClient({ url: TEST_DB });
  const migrationDir = path.resolve(__dirname, "../../drizzle");
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    // Split on statement boundaries — drizzle migrations use --> statement-breakpoint
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }
});

describe("BetterAuth routes", () => {
  it("POST /api/auth/sign-up/email creates a user", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();

    const request = new Request(
      "http://localhost:3000/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
        }),
      }
    );

    const response = await auth.handler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.name).toBe("Test User");
  });

  it("POST /api/auth/sign-in/email signs in an existing user", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();

    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      }
    );

    const response = await auth.handler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("test@example.com");
  });

  it("POST /api/auth/sign-in/email rejects wrong password", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();

    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      }
    );

    const response = await auth.handler(request);
    // BetterAuth returns 200 with error in body, or 401/400
    const body = await response.json();
    const isRejected =
      response.status === 401 ||
      response.status === 400 ||
      body?.error != null;
    expect(isRejected).toBe(true);
  });

  it("GET /api/auth/ok returns health check", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();

    const request = new Request("http://localhost:3000/api/auth/ok", {
      method: "GET",
    });

    const response = await auth.handler(request);
    expect(response.status).toBe(200);
  });
});
