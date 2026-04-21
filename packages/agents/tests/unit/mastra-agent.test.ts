import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.OPENAI_API_KEY = "sk-test-fake-key-for-unit-tests";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake-key";
});

describe("Mastra foreman agent", () => {
  it("createForemanAgent is async and returns an agent", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-agent.db");

    expect(agent).toBeDefined();
    expect(agent.name).toBe("Foreman");
    expect(agent.id).toBe("foreman");
  }, 30000); // MCP server startup can take time

  it("has the 3 custom tools registered", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-agent.db");

    // Agent tools are accessible via listTools()
    const tools = await agent.listTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("search_history");
    expect(toolNames).toContain("fork_conversation");
    expect(toolNames).toContain("connect_zapier");
  }, 30000);

  it("MODELS constants are correct", async () => {
    const { MODELS } = await import("@/mastra/agents/foreman");
    expect(MODELS.default).toBe("anthropic/claude-sonnet-4-6");
    expect(MODELS.fast).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(MODELS.heavy).toBe("anthropic/claude-opus-4-6");
  }, 30000);
});
