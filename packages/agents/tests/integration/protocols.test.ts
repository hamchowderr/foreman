import { describe, it, expect, beforeAll } from "vitest";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:4111";

/**
 * Integration tests for Mastra-generated protocol endpoints.
 *
 * Prerequisites:
 *   cd packages/agents && npm run dev
 *
 * Then run:
 *   npm test -- tests/integration/protocols.test.ts
 */

async function serverIsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/api/agents`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

describe("Protocol endpoints", () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await serverIsReachable();
    if (!reachable) {
      console.warn(
        `\n⚠  Agent server not reachable at ${AGENT_URL}. Skipping protocol tests.\n` +
          `   Start it with: cd packages/agents && npm run dev\n`,
      );
    }
  });

  // ── Agent Card (A2A discovery) ────────────────────────────────────────

  describe("Agent card discovery", () => {
    it("GET /.well-known/foreman/agent-card.json returns agent metadata", async ({
      skip,
    }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/.well-known/foreman/agent-card.json`);
      expect(res.status).toBe(200);

      const card = await res.json();
      expect(card.name).toBe("Foreman");
      expect(card.description).toContain("Zapier");
    });

    it("agent card declares A2A-compatible capabilities", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/.well-known/foreman/agent-card.json`);
      const card = await res.json();

      // A2A agent cards must include these top-level fields
      expect(card).toHaveProperty("name");
      expect(card).toHaveProperty("description");
      expect(card).toHaveProperty("url");
      expect(card).toHaveProperty("capabilities");
    });
  });

  // ── A2A (JSON-RPC) ───────────────────────────────────────────────────

  describe("A2A endpoint", () => {
    it("POST /a2a/foreman accepts JSON-RPC and returns 200", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/a2a/foreman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "agent/discover",
          id: "test-1",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("jsonrpc", "2.0");
      expect(body).toHaveProperty("id", "test-1");
    });

    it("POST /a2a/foreman returns error for unknown method", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/a2a/foreman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "nonexistent/method",
          id: "test-err",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // JSON-RPC errors are returned as 200 with an error field
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("POST /a2a/foreman rejects invalid JSON-RPC", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/a2a/foreman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not: "jsonrpc" }),
      });

      // Should return 200 with JSON-RPC error or 400
      expect([200, 400]).toContain(res.status);
    });
  });

  // ── MCP ───────────────────────────────────────────────────────────────

  describe("MCP endpoint", () => {
    it("GET /mcp does not return 404", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/mcp`);
      // MCP may return SSE stream, redirect, or JSON — but should not 404
      expect(res.status).not.toBe(404);
    });

    it("POST /mcp accepts MCP initialize request", async ({ skip }) => {
      if (!reachable) skip();

      const res = await fetch(`${AGENT_URL}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "0.1.0" },
          },
          id: "mcp-init-1",
        }),
      });

      // MCP server should accept the request (not 404/405)
      expect([200, 202]).toContain(res.status);
    });
  });
});
