/**
 * Model configuration for the frontend.
 * The actual model is selected by the agent server — this is for display/selection UI only.
 */

export const DEFAULT_CHAT_MODEL = "foreman";

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

export const chatModels: ChatModel[] = [
  {
    id: "foreman",
    name: "Foreman",
    provider: "anthropic",
    description: "AI assistant powered by Claude",
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export async function getCapabilities(): Promise<Record<string, ModelCapabilities>> {
  return {
    foreman: { tools: true, vision: false, reasoning: true },
  };
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
