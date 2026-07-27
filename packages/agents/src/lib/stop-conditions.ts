/**
 * Agent stop conditions.
 *
 * `stopWhen` is a **Mastra** agent option, so what we pass must satisfy Mastra's
 * `StopCondition` — not the AI SDK's. Those two drifted apart in AI SDK v7:
 * `ai`'s `stepCountIs` now returns `StopCondition<any, any>` (its `StepResult`
 * gained `callId`, `stepNumber`, `model`, `toolsContext`, …) while Mastra 1.53
 * still declares the single-parameter `StopCondition<any>`. Importing it from
 * `ai` therefore stops type-checking against every `agent.generate()` /
 * `agent.stream()` call.
 *
 * The behaviour is a one-line step count and identical in both versions, so we
 * own it here rather than coupling eleven channel bots to the AI SDK's major
 * version. Nothing about this is a workaround at runtime — Mastra invokes the
 * condition with `{ steps }` exactly as before.
 *
 * Revisit when Mastra's agent surface adopts the v7 `StopCondition` shape; at
 * that point this can go back to a plain `import { stepCountIs } from "ai"`.
 */

/** Stop once the agent has taken `stepCount` steps. */
export function stepCountIs(stepCount: number) {
  return ({ steps }: { steps: readonly unknown[] }) => steps.length >= stepCount;
}
