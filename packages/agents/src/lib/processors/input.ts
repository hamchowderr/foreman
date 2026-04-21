import type {
  ProcessInputArgs,
  InputProcessor,
} from "@mastra/core/processors";
import { listUserConnections } from "../zapier";
import { searchAppCatalog } from "../catalog";

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

      const extraMessages: Array<{ role: "system"; content: string }> = [contextMessage];

      // Semantic app catalog search — suggest relevant apps based on user's message
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const userText =
          typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : Array.isArray(lastUserMsg.content)
              ? lastUserMsg.content
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join(" ")
              : "";

        if (userText && userText.length >= 10) {
          try {
            const catalogResults = await searchAppCatalog(userText, 5);
            // Only inject suggestions when the top result has a strong match.
            // Low scores (< 0.4) mean the query isn't about app discovery —
            // e.g., "I can manage, thanks" returns low-scoring noise.
            const relevant = catalogResults.filter((r) => r.score >= 0.4);
            if (relevant.length >= 2) {
              const suggestions = relevant
                .map((r) => `${r.title} (${r.categories || "uncategorized"}) [${r.score.toFixed(2)}]`)
                .join(", ");
              extraMessages.push({
                role: "system" as const,
                content: `[App Suggestions] Based on the user's request, these Zapier apps may be relevant: ${suggestions}. Use list-actions to explore if the user is interested.`,
              });
            }
          } catch {
            // Catalog search is best-effort — don't block on failure
          }
        }
      }

      return {
        messages,
        systemMessages: [...systemMessages, ...extraMessages],
      };
    } catch {
      // If connection lookup fails, proceed without context — don't block the conversation
      return { messages, systemMessages };
    }
  },
};

