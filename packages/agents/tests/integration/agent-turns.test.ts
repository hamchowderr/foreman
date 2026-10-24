import { beforeAll, describe, expect, it, vi } from "vitest";
import { AIMOCK_HAIKU, journalFor, useDirectAnthropicModels } from "../helpers/aimock";

/**
 * Real agent turns, end to end through the AI SDK, against AIMock fixtures
 * (tests/fixtures/aimock/agent-turns.json). Uses the History agent because it
 * needs no Zapier SDK and no Postgres-backed memory.
 */

const searchActionHistory = vi.fn();
vi.mock("@/lib/rag", () => ({ searchActionHistory }));

let createHistoryAgent: typeof import("@/mastra/agents/history").createHistoryAgent;

beforeAll(async () => {
  useDirectAnthropicModels();
  ({ createHistoryAgent } = await import("@/mastra/agents/history"));
});

describe("agent turns via AIMock", () => {
  it("sends the agent's model, system prompt and tools to the provider", async () => {
    const agent = createHistoryAgent();
    const result = await agent.generate("hello");

    expect(result.text).toMatch(/Foreman/);
    const [req] = await journalFor("hello");
    expect(req.body.model).toBe(AIMOCK_HAIKU.replace("anthropic/", ""));
    expect(JSON.stringify(req.body.messages?.[0])).toContain("History Agent");
    expect(req.body.tools?.map((t) => t.function?.name)).toEqual(["search_history"]);
  });

  it("runs a tool call and answers from its result", async () => {
    searchActionHistory.mockResolvedValueOnce([
      { score: 0.91, metadata: { app: "gmail", action: "send_email", executedAt: "2026-10-12" } },
    ]);
    const agent = createHistoryAgent();
    const result = await agent.generate("what did I send last week", { maxSteps: 3 });

    expect(searchActionHistory).toHaveBeenCalledWith("emails sent last week", "user_test_1", 5);
    expect(result.text).toBe("Last week you sent one email with Gmail.");

    const requests = await journalFor("what did I send last week");
    expect(requests).toHaveLength(2);
    // The second request carries the tool result the model sees (toModelOutput summary).
    expect(JSON.stringify(requests[1].body.messages)).toContain('\\"app\\":\\"gmail\\"');
  });

  it("redacts API keys from model output", async () => {
    const agent = createHistoryAgent();
    const result = await agent.generate("show me the leaked key");

    expect(result.text).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(result.text).toContain("[API_KEY]");
  });

  it("surfaces a provider error instead of answering", async () => {
    const agent = createHistoryAgent();
    await expect(agent.generate("provider is having an outage")).rejects.toThrow(/Invalid request/);
  });
});
