import { metrics } from "@opentelemetry/api";
import type { AgentName } from "./models";
import { AGENT_MODELS, primary } from "./models";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
}

// Prices as of 2026-04 — update when providers change rates
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  "anthropic/claude-haiku-4-5-20251001": { inputPer1M: 1, outputPer1M: 5, cachedInputPer1M: 0.1 },
  "anthropic/claude-haiku-4-5": { inputPer1M: 1, outputPer1M: 5, cachedInputPer1M: 0.1 },
  "anthropic/claude-opus-4-6": { inputPer1M: 15, outputPer1M: 75, cachedInputPer1M: 1.5 },
  "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "openai/gpt-4-turbo": { inputPer1M: 10, outputPer1M: 30 },
  "openai/gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "openai/gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "google/gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "google/gemini-2.0-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "google/gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
};

export interface UsageTokens {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
  reasoningTokens?: number | undefined;
}

export interface CostBreakdown {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  cachedInputCostUsd: number;
  totalCostUsd: number;
  pricingMissing: boolean;
}

function providerOf(model: string): string {
  const slash = model.indexOf("/");
  return slash > 0 ? model.slice(0, slash) : "unknown";
}

export function calculateCost(model: string, usage: UsageTokens): CostBreakdown {
  const pricing = MODEL_PRICING[model];
  const provider = providerOf(model);
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const freshInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  if (!pricing) {
    return {
      model,
      provider,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      inputCostUsd: 0,
      outputCostUsd: 0,
      cachedInputCostUsd: 0,
      totalCostUsd: 0,
      pricingMissing: true,
    };
  }

  const cachedPer1M = pricing.cachedInputPer1M ?? pricing.inputPer1M;
  const inputCostUsd = (freshInputTokens * pricing.inputPer1M) / 1_000_000;
  const cachedInputCostUsd = (cachedInputTokens * cachedPer1M) / 1_000_000;
  const outputCostUsd = (outputTokens * pricing.outputPer1M) / 1_000_000;
  return {
    model,
    provider,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    inputCostUsd,
    outputCostUsd,
    cachedInputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd + cachedInputCostUsd,
    pricingMissing: false,
  };
}

const otelEnabled = process.env.OTEL_ENABLED === "true";
let _costCounter: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]> | undefined;
function getCostCounter() {
  if (!otelEnabled) return undefined;
  if (_costCounter) return _costCounter;
  _costCounter = metrics.getMeter("foreman-agents").createCounter("foreman.llm.cost.usd", {
    description: "USD cost of LLM calls attributed to a Foreman agent.",
    unit: "USD",
  });
  return _costCounter;
}

export function onFinishCostLogger(agent: AgentName) {
  return (event: { totalUsage?: UsageTokens }): void => {
    const model = primary(AGENT_MODELS[agent]);
    const usage = event?.totalUsage ?? { inputTokens: 0, outputTokens: 0 };
    const breakdown = calculateCost(model, usage);
    console.log(JSON.stringify({ msg: "llm.cost", agent, ...breakdown }));
    const counter = getCostCounter();
    if (counter && breakdown.totalCostUsd > 0) {
      counter.add(breakdown.totalCostUsd, {
        agent,
        model: breakdown.model,
        provider: breakdown.provider,
      });
    }
  };
}
