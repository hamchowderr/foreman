import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

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

  it("has the custom tools registered", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const agent = await createForemanAgent("file:./test-agent.db");

    // Agent tools are accessible via listTools()
    const tools = await agent.listTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("search_history");
    expect(toolNames).toContain("fork_conversation");
    expect(toolNames).toContain("connect_zapier");
    expect(toolNames).toContain("save_workflow");
    expect(toolNames).toContain("list_workflows");
    expect(toolNames).toContain("get_workflow");
    expect(toolNames).toContain("run_workflow");
    expect(toolNames).toContain("update_workflow");
    expect(toolNames).toContain("delete_workflow");
  }, 30000);

  it("foreman agent uses AGENT_MODELS.foreman as its model", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const { AGENT_MODELS } = await import("@/lib/providers");
    const agent = await createForemanAgent("file:./test-agent.db");
    expect(agent.model).toEqual(AGENT_MODELS.foreman);
  }, 30000);

  it("hosts the zapier poll SignalProvider and connects it on construction", async () => {
    const { createForemanAgent } = await import("@/mastra/agents/foreman");
    const { zapierPollProvider } = await import("@/mastra/signals/zapier-poll-provider");
    await createForemanAgent("file:./test-agent.db");
    // The Agent constructor calls provider.connect(this) for each signals entry,
    // proving the primitive is live in the agent (not merely defined).
    expect(zapierPollProvider.isConnected).toBe(true);
    // No pollInterval — we drive runDuePolls() from cron-driver-server, so the
    // framework must NOT auto-poll it in every process the agent is built in.
    expect(zapierPollProvider.pollInterval).toBeUndefined();
  }, 30000);
});
