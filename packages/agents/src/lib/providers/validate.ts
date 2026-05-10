import { AGENT_REQUIREMENTS, MODEL_CAPABILITIES } from "./capabilities";
import { AGENT_MODELS, type AgentName, asList } from "./models";

export function validateAgentCapabilities(): void {
  const errors: string[] = [];

  for (const [agent, spec] of Object.entries(AGENT_MODELS) as [
    AgentName,
    (typeof AGENT_MODELS)[AgentName],
  ][]) {
    const required = AGENT_REQUIREMENTS[agent] ?? [];
    for (const model of asList(spec)) {
      const caps = MODEL_CAPABILITIES[model];
      if (!caps) {
        errors.push(
          `Agent "${agent}" configured with unknown model "${model}". ` +
            `Add it to MODEL_CAPABILITIES in src/lib/providers/capabilities.ts.`,
        );
        continue;
      }
      for (const req of required) {
        if (!caps.has(req)) {
          errors.push(
            `Agent "${agent}" requires "${req}" but model "${model}" doesn't support it.`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Provider capability check failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}
