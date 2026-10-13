import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { InMemoryStore } from "@mastra/core/storage";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { MockLanguageModelV3 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { SCHEDULE_AGENT_ID, startScheduleTool } from "@/mastra/tools/schedules";

/**
 * A schedule fire reaches the agent through `agent.sendSignal`, outside any HTTP
 * request. This drives Mastra's real scheduler end to end (create → run → wake) and
 * checks the fired run's tools see the creator's userId and workspaceId — the request
 * context Foreman's Zapier tools and per-tenant workspace resolve from.
 */

const seen: Array<{ userId: unknown; workspaceId: unknown }> = [];

const whoami = createTool({
  id: "whoami",
  description: "Report who this run acts as.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    seen.push({
      userId: ctx?.requestContext?.get("userId"),
      workspaceId: ctx?.requestContext?.get("workspaceId"),
    });
    return { ok: true };
  },
});

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** First step calls whoami; every later step answers with text. */
function model() {
  let calls = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      calls += 1;
      const chunks: any[] =
        calls === 1
          ? [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: "call-1", toolName: "whoami", input: "{}" },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage },
            ]
          : [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: "done" },
              { type: "text-end", id: "t" },
              { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
      };
    },
  });
}

const storage = new InMemoryStore();
const memory = new Memory({ storage });
const agent = new Agent({
  id: SCHEDULE_AGENT_ID,
  name: "Foreman (test)",
  instructions: "Call whoami.",
  // MockLanguageModelV3 is a valid V3 model at runtime; its doGenerate typing differs.
  model: model() as any,
  memory,
  tools: { whoami },
});
const mastra = new Mastra({ agents: { [SCHEDULE_AGENT_ID]: agent }, storage, logger: false });

// A server (or `mastra dev`) starts these; the scheduler fires nothing without them.
beforeAll(async () => {
  await mastra.startWorkers();
});

afterAll(async () => {
  await mastra.stopWorkers?.();
});

describe("schedule fire identity", () => {
  it("runs the fired turn as the schedule's creator, in their workspace", async () => {
    const resourceId = "user-123";
    const thread = await memory.createThread({ resourceId, title: "scheduled" });

    const created = await startScheduleTool.execute!({ cron: "0 9 * * *", prompt: "Check in." }, {
      mastra,
      agent: { threadId: thread.id, resourceId },
      requestContext: new RequestContext([
        ["userId", resourceId],
        ["workspaceId", "ws-abc"],
      ]),
    } as any);

    await mastra.schedules.run((created as any).id);
    for (let i = 0; i < 100 && seen.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(seen).toEqual([{ userId: resourceId, workspaceId: "ws-abc" }]);
  }, 15_000);

  it("refuses to create a schedule without a signed-in user", async () => {
    const thread = await memory.createThread({ resourceId: "user-9", title: "t" });
    await expect(
      startScheduleTool.execute!({ cron: "0 9 * * *", prompt: "x" }, {
        mastra,
        agent: { threadId: thread.id, resourceId: "user-9" },
        requestContext: new RequestContext(),
      } as any),
    ).rejects.toThrow(/signed-in user/);
  });
});
