import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const forkConversationTool = createTool({
  id: "fork_conversation",
  strict: true,
  description:
    "Fork (clone) the current conversation thread to explore a different automation path. " +
    "Creates a copy of the conversation history so the user can try alternative approaches " +
    "without losing the original thread. Returns the new thread ID to continue on.",
  inputSchema: z.object({
    threadId: z.string().describe("The current thread ID to fork from"),
    title: z.string().optional().describe("Optional title for the forked conversation"),
    messageLimit: z
      .number()
      .optional()
      .describe("Optional limit on how many recent messages to copy (copies all if omitted)"),
  }),
  outputSchema: z.object({
    newThreadId: z.string(),
    title: z.string(),
    messagesCopied: z.number(),
    sourceThreadId: z.string(),
  }),
  onInputStart: ({ toolCallId }) => {
    console.log(
      `[tool:fork_conversation] Input streaming started (callId=${toolCallId.slice(0, 8)})`,
    );
  },
  onInputAvailable: ({ input, toolCallId }) => {
    const i = input as any;
    console.log(
      `[tool:fork_conversation] Input available: thread=${i?.threadId?.slice(0, 8)} limit=${i?.messageLimit ?? "(all)"} (callId=${toolCallId.slice(0, 8)})`,
    );
  },
  onOutput: ({ output, toolName }) => {
    const o = output as any;
    console.log(
      `[tool:${toolName}] Forked ${o?.sourceThreadId} → ${o?.newThreadId} (${o?.messagesCopied} messages)`,
    );
  },
  execute: async ({ threadId, title, messageLimit }, ctx) => {
    // Top-level data-* chunk so the UI renders forking progress as a discrete
    // part. transient: true — the in-flight "cloning..." message is chatter,
    // not data the chat history needs to replay on refresh.
    await ctx?.writer?.custom({
      type: "data-tool-progress",
      data: {
        tool: "fork_conversation",
        status: "forking",
        sourceThreadId: threadId,
        messageLimit,
      },
      transient: true,
    });

    const agentId = ctx.agent?.agentId;
    if (!agentId || !ctx.mastra) {
      throw new Error("Tool must be executed within an agent context to access memory");
    }

    const agent = ctx.mastra.getAgent(agentId);
    const memory = await agent.getMemory();
    if (!memory) {
      throw new Error("Memory is not configured — cannot fork conversation");
    }

    const cloneArgs: {
      sourceThreadId: string;
      title?: string;
      options?: { messageLimit?: number };
    } = {
      sourceThreadId: threadId,
    };

    if (title) {
      cloneArgs.title = title;
    }

    if (messageLimit) {
      cloneArgs.options = { messageLimit };
    }

    const { thread, clonedMessages } = await memory.cloneThread(cloneArgs);

    return {
      newThreadId: thread.id,
      title: thread.title ?? "Forked conversation",
      messagesCopied: clonedMessages.length,
      sourceThreadId: threadId,
    };
  },
});
