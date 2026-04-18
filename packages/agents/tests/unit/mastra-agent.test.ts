import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test-agent.db";
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.OPENAI_API_KEY = "sk-test-fake-key-for-unit-tests";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake-key";
});

function getAgentTools(agent: any): Record<string, any> {
  return agent.__getOverridableFields().tools;
}

describe("Mastra foreman agent", () => {
  it("instantiates with all 6 tools registered", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = createForemanAgent("file:./test-agent.db");

    expect(agent).toBeDefined();
    expect(agent.name).toBe("Foreman");

    const tools = getAgentTools(agent);
    expect(tools).toBeDefined();

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain("discover_connections");
    expect(toolNames).toContain("list_actions");
    expect(toolNames).toContain("get_action_schema");
    expect(toolNames).toContain("get_field_choices");
    expect(toolNames).toContain("execute_action");
    expect(toolNames).toContain("raw_api_call");
    expect(toolNames).toHaveLength(16);
  });

  it("execute_action uses conversational approval (no requireApproval)", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = createForemanAgent("file:./test-agent.db");
    const tools = getAgentTools(agent);
    const tool = tools["execute_action"];
    expect(tool).toBeDefined();
    expect(tool.requireApproval).toBeFalsy();
  });

  it("raw_api_call uses conversational approval (no requireApproval)", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = createForemanAgent("file:./test-agent.db");
    const tools = getAgentTools(agent);
    const tool = tools["raw_api_call"];
    expect(tool).toBeDefined();
    expect(tool.requireApproval).toBeFalsy();
  });

  it("discovery tools do not have requireApproval", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = createForemanAgent("file:./test-agent.db");
    const tools = getAgentTools(agent);

    const discoveryTools = [
      "discover_connections",
      "list_actions",
      "get_action_schema",
      "get_field_choices",
    ];

    for (const name of discoveryTools) {
      const tool = tools[name];
      expect(tool.requireApproval).toBeFalsy();
    }
  });
});
