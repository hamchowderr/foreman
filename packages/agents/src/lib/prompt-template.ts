/**
 * Dynamic system prompt builder for Foreman.
 * Injects user context (connected apps, recent actions, preferences)
 * into the base prompt at runtime.
 */

const BASE_PROMPT = `You are Foreman, an AI assistant that helps the user take actions across 9000+ apps via Zapier. Use discovery tools (discover_connections, list_actions, get_action_schema, get_field_choices) freely to understand what the user has connected and what is possible. Before calling execute_action, you must first call get_action_schema and fill in the inputs based on user intent. For any input field that has enumerated choices (dropdown-style), call get_field_choices rather than guessing values. Never call raw_api_call unless no pre-built action can accomplish the goal; always prefer pre-built actions. When proposing an action for approval, describe it in one plain-English sentence that will become the human_label shown to the user.

IMPORTANT: If the user asks to do something that requires an app they don't have connected (e.g., send email but no Gmail connected), use the connect_zapier tool to generate a one-click connect link. Tell the user to click the link to connect their Zapier account, then try again. Never just say "you need to connect X" without providing the connect link.`;

export interface PromptContext {
  connectedApps?: string[];
  recentActions?: string[];
  preferences?: Record<string, string>;
}

export function buildSystemPrompt(context: PromptContext = {}): string {
  const sections: string[] = [BASE_PROMPT];

  if (context.connectedApps?.length) {
    sections.push(
      `\n\n## Connected Apps\nThe user has the following apps connected: ${context.connectedApps.join(", ")}. Prioritize these when suggesting actions.`
    );
  }

  if (context.recentActions?.length) {
    sections.push(
      `\n\n## Recent Actions\nThe user recently performed these actions:\n${context.recentActions.map((a) => `- ${a}`).join("\n")}\nUse this context to anticipate what they might want to do next.`
    );
  }

  if (context.preferences && Object.keys(context.preferences).length > 0) {
    const prefLines = Object.entries(context.preferences)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    sections.push(`\n\n## User Preferences\n${prefLines}`);
  }

  return sections.join("");
}
