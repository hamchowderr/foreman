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

// NOTE: `id` stays "foreman" — it's the agent identifier the server routes on.
// `name`/`provider` are display-only (the composer's model selector). Foreman
// runs on Claude Sonnet 4.6 server-side, so we surface that honestly.
export const chatModels: ChatModel[] = [
  {
    id: "foreman",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Foreman runs on Anthropic's Claude Sonnet 4.6",
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Claude (Sonnet/Opus) is vision-capable, so the chat accepts image attachments.
  foreman: { tools: true, vision: true, reasoning: true },
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
