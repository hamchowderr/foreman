/**
 * Model configuration for the frontend.
 * The actual model is selected by the agent server — this is for display/selection UI only.
 */

export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4-6";

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
  gatewayOrder?: string[];
  reasoningEffort?: string;
};

// `id` is the actual `provider/model` string the agent server routes on (it is
// sent in the chat request body and validated server-side against an allowlist).
// All three are Anthropic so Foreman's prompt/tool cache-control stays valid.
export const chatModels: ChatModel[] = [
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Balanced — Foreman's default",
  },
  {
    id: "anthropic/claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most capable — deeper reasoning, slower",
  },
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest — lighter tasks",
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // All Claude 4.x models are tool- + vision-capable, so the chat accepts image attachments.
  "anthropic/claude-sonnet-4-6": { tools: true, vision: true, reasoning: true },
  "anthropic/claude-opus-4-6": { tools: true, vision: true, reasoning: true },
  "anthropic/claude-haiku-4-5-20251001": { tools: true, vision: true, reasoning: true },
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
