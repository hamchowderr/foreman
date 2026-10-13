import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// Cold-importing the Foreman agent tree (Mastra core, memory, chat adapters,
// Zapier SDK) took 10s pinned to one CPU and can pass 30s when the whole suite
// runs in parallel on a busy machine. Pay it once in this hook so each test only
// times its own work (foreman-zyzk).
let createForemanAgent: typeof import("@/mastra/agents/foreman").createForemanAgent;

beforeAll(async () => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.OPENAI_API_KEY = "sk-test-fake-key-for-unit-tests";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake-key";
  ({ createForemanAgent } = await import("@/mastra/agents/foreman"));
}, 120_000);

describe("Mastra foreman agent", () => {
  it("createForemanAgent is async and returns an agent", async () => {
    const agent = await createForemanAgent("file:./test-agent.db");

    expect(agent).toBeDefined();
    expect(agent.name).toBe("Foreman");
    expect(agent.id).toBe("foreman");
  }, 30000); // MCP server startup can take time

  it("has the custom tools registered", async () => {
    const agent = await createForemanAgent("file:./test-agent.db");

    // Agent tools are accessible via listTools()
    const tools = await agent.listTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("search_history");
    expect(toolNames).toContain("fork_conversation");
    expect(toolNames).toContain("connect_zapier");
    expect(toolNames).toContain("create_dashboard");
  }, 30000);

  it("foreman agent uses AGENT_MODELS.foreman as its model", async () => {
    const { AGENT_MODELS } = await import("@/lib/providers");
    const agent = await createForemanAgent("file:./test-agent.db");
    expect(agent.model).toEqual(AGENT_MODELS.foreman);
  }, 30000);
});
