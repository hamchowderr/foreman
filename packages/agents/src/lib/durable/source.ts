import type { AutomationSpec } from "./types";

/**
 * Generate a durable `workflow.ts` source string from a simple linear spec.
 *
 * Emits the parser-friendly shape the durable editor recognizes: a module-level
 * `createZapierSdk()`, one `ctx.step` per app action whose body is a single
 * `sdk.runAction({...})`, and `export default`. For anything dynamic (input
 * schemas, loops, waits, branches, cross-step references) the agent authors the
 * source directly — this generator only covers static linear chains.
 */
export function buildDurableSource(spec: AutomationSpec): string {
  const q = (v: unknown) => JSON.stringify(v);

  const stepLines = spec.steps.map((step, i) => {
    const v = `step_${i}`;
    return (
      `  const ${v} = await ctx.step(${q(step.id)}, async () =>\n` +
      `    sdk.runAction({ appKey: ${q(step.appKey)}, actionType: ${q(step.actionType)}, ` +
      `actionKey: ${q(step.actionKey)}, connection: ${q(step.connection)}, ` +
      `inputs: ${q(step.inputs ?? {})} }),\n` +
      `  );`
    );
  });

  const returns = spec.steps.map((_, i) => `step_${i}`).join(", ");

  return [
    `import { defineDurable } from "@zapier/zapier-durable";`,
    `import { createZapierSdk } from "@zapier/zapier-sdk";`,
    ``,
    `const sdk = createZapierSdk();`,
    ``,
    `const workflow = defineDurable(${q(spec.name)}, async (ctx) => {`,
    ...stepLines,
    `  return { ${returns} };`,
    `});`,
    ``,
    `export default workflow;`,
    ``,
  ].join("\n");
}
