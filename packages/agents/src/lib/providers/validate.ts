import { AGENT_MODELS, asList, type AgentName } from "./models";
import { AGENT_REQUIREMENTS, MODEL_CAPABILITIES } from "./capabilities";

/**
 * Verify every configured agent model is known and supports the capabilities
 * that agent requires. Fails fast at startup with a message naming the
 * offending agent, model, and missing capability.
 *
 * Fallback chains are validated per entry — every model in the chain must
 * satisfy the agent's requirements.
 */
export function validateAgentCapabilities(): void {
  const errors: string[] = [];

  for (const [agent, spec] of Object.entries(AGENT_MODELS) as [AgentName, typeof AGENT_MODELS[AgentName]][]) {
    const required = AGENT_REQUIREMENTS[agent] ?? [];
    for (const model of asList(spec)) {
      const caps = MODEL_CAPABILITIES[model];
      if (!caps) {
        errors.push(
          `Agent "${agent}" is configured with unknown model "${model}". ` +
            `Add it to MODEL_CAPABILITIES in src/lib/providers/capabilities.ts, ` +
            `or check the env var for a typo.`,
        );
        continue;
      }
      for (const req of required) {
        if (!caps.has(req)) {
          errors.push(
            `Agent "${agent}" requires capability "${req}" but model ` +
              `"${model}" does not support it. Pick a different model or ` +
              `update MODEL_CAPABILITIES if the registry is out of date.`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      "Provider capability check failed:\n" +
        errors.map((e) => "  - " + e).join("\n"),
    );
  }
}
