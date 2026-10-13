/**
 * Model configuration for the frontend.
 * The actual model is selected by the agent server — this is for display/selection UI only.
 */

export const DEFAULT_CHAT_MODEL = "vercel/anthropic/claude-sonnet-4.6";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  /** Context-window size in tokens (used by the composer's context-usage gauge). */
  contextWindow: number;
  gatewayOrder?: string[];
  reasoningEffort?: string;
};

// Claude 4.x models share a 200k-token context window.
const CLAUDE_CONTEXT_WINDOW = 200_000;

// `id` is the actual `provider/model` string the agent server routes on (it is
// sent in the chat request body and validated server-side against an allowlist).
// All three are Claude through the Vercel AI Gateway (`vercel/` prefix), so
// Foreman's prompt/tool cache-control stays valid.
export const chatModels: ChatModel[] = [
  {
    id: "vercel/anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Balanced — Foreman's default",
    contextWindow: CLAUDE_CONTEXT_WINDOW,
  },
  {
    id: "vercel/anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most capable — deeper reasoning, slower",
    contextWindow: CLAUDE_CONTEXT_WINDOW,
  },
  {
    id: "vercel/anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest — lighter tasks",
    contextWindow: CLAUDE_CONTEXT_WINDOW,
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

/** Context-window size for a model id, falling back to the default model's window. */
export function getContextWindow(modelId: string | undefined): number {
  return (
    chatModels.find((m) => m.id === modelId)?.contextWindow ??
    chatModels.find((m) => m.id === DEFAULT_CHAT_MODEL)?.contextWindow ??
    CLAUDE_CONTEXT_WINDOW
  );
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // All Claude 4.x models are tool- + vision-capable, so the chat accepts image attachments.
  "vercel/anthropic/claude-sonnet-4.6": { tools: true, vision: true, reasoning: true },
  "vercel/anthropic/claude-opus-4.6": { tools: true, vision: true, reasoning: true },
  "vercel/anthropic/claude-haiku-4.5": { tools: true, vision: true, reasoning: true },
};

export async function getCapabilities(): Promise<Record<string, ModelCapabilities>> {
  return MODEL_CAPABILITIES;
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>,
);

export const isDemo = false;
