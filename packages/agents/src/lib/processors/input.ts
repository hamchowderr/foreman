import type {
  ProcessInputArgs,
  InputProcessor,
} from "@mastra/core/processors";
import { listUserConnections } from "../zapier";

/**
 * Input processor that injects user context (connected apps, recent actions)
 * into the conversation before the LLM call.
 */
export const contextInjector: InputProcessor = {
  id: "context-injector",
  name: "Context Injector",
  description:
    "Injects user Zapier connection context into system messages before LLM call",

  async processInput({ messages, systemMessages, requestContext }: ProcessInputArgs) {
    const userId = requestContext?.get("userId") as string | undefined;
    if (!userId) {
      return { messages, systemMessages };
    }

    try {
      const connections = await listUserConnections(userId);

      if (!connections || connections.length === 0) {
        return { messages, systemMessages };
      }

      const appSummary = connections
        .map((c: { app_name?: string; app_key?: string }) => c.app_name ?? c.app_key)
        .filter(Boolean)
        .join(", ");

      const contextMessage = {
        role: "system" as const,
        content: `[User Context] The user has ${connections.length} connected app(s): ${appSummary}. Use this to proactively suggest relevant actions without requiring a discovery tool call first.`,
      };

      return {
        messages,
        systemMessages: [...systemMessages, contextMessage],
      };
    } catch {
      // If connection lookup fails, proceed without context — don't block the conversation
      return { messages, systemMessages };
    }
  },
};
