import { activeDurableAdapter, type DurableAdapter } from "./delivery";
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
/**
 * Canonical human-approval gate for durable source (foreman-zfnj). `ctx.createCallback`
 * mints a callback URL that `getDurableRun` does NOT expose; Foreman resolves it
 * (`resolveCallbackUrl`) from a step the durable authors to REPORT it. Any durable with
 * an approval gate MUST emit this pattern so the /automations Approve/Deny action can
 * POST to the URL. Returns source lines that: create the gate, report its `{ callbackUrl,
 * callbackName }` via a step, and await the decision into `<id>Decision`.
 */
export function humanApprovalGate(name: string, adapter?: DurableAdapter): string {
  const q = (v: unknown) => JSON.stringify(v);
  const id = name.replace(/[^a-zA-Z0-9_$]/g, "_").replace(/^([0-9])/, "_$1");
  const target = adapter ?? activeDurableAdapter();

  // On the filesystem adapter the run is local, so Foreman reads the callback
  // token straight off the execution's operations (`findOpenLocalGate`). The
  // URL never has to cross a wire, so neither the binding nor the reporting
  // step is emitted — one less step to journal and replay per approval.
  if (target === "filesystem") {
    return [
      `  const [${id}Approval] = await ctx.createCallback(${q(name)});`,
      `  const ${id}Decision = await ${id}Approval;`,
    ].join("\n");
  }

  return [
    `  const [${id}Approval, ${id}Url] = await ctx.createCallback(${q(name)});`,
    `  await ctx.step(${q(`__report_callback_url_${name}`)}, async () => ({ callbackUrl: ${id}Url, callbackName: ${q(name)} }));`,
    `  const ${id}Decision = await ${id}Approval;`,
  ].join("\n");
}

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
