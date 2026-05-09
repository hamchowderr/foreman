/**
 * Regression test for the mastra dev hang.
 *
 * Bug: createZapierSdk() called at module load mutates the process-global
 * Symbol(_zod) registry. When that mutation lands BEFORE new Mastra() runs,
 * Mastra Studio's internal toJSONSchema introspection enters an infinite loop
 * instead of throwing — mastra dev hangs at "[file-logger] Logging to server.log"
 * with no further output and no port bound.
 *
 * Fix (914f9b0): use Mastra's DynamicArgument function form for `tools` and
 * `inputProcessors` so the SDK call only fires at request time, after
 * new Mastra(...) has finished constructing.
 *
 * This test catches any refactor that puts the SDK call back at module load
 * or at agent-construction time.
 *
 * See: vault note reference_foreman_mastra_dev_hang.md
 */
import { describe, it, expect, vi } from "vitest";

// The agents construct embedders/scorers/voice at factory-call time, all of
// which validate API keys synchronously. Provide placeholder keys so the
// constructors don't throw — none of these are actually used by this test.
process.env.OPENAI_API_KEY ??= "sk-test-not-used";
process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-not-used";

// Spy must be installed BEFORE the agent modules are imported.
const createZapierSdkSpy = vi.fn(() => {
  throw new Error(
    "Zapier SDK was instantiated at module load or agent construction. " +
    "This re-introduces the mastra dev hang. The SDK must be deferred to " +
    "request time via Mastra's DynamicArgument tools/inputProcessors function form. " +
    "See vault note reference_foreman_mastra_dev_hang.md."
  );
});

vi.mock("@zapier/zapier-sdk", async () => {
  // Preserve real error classes so `instanceof` checks in handleSdkError still work.
  const actual = await vi.importActual<typeof import("@zapier/zapier-sdk")>(
    "@zapier/zapier-sdk"
  );
  return {
    ...actual,
    createZapierSdk: createZapierSdkSpy,
  };
});

describe("Zapier SDK lazy-init (mastra dev hang regression)", () => {
  it("does not call createZapierSdk when importing agent modules", async () => {
    await import("../../src/mastra/agents/foreman");
    await import("../../src/mastra/agents/discovery");
    await import("../../src/mastra/agents/execution");
    expect(createZapierSdkSpy).not.toHaveBeenCalled();
  });

  it("does not call createZapierSdk when constructing the foreman agent", async () => {
    const { createForemanAgent } = await import("../../src/mastra/agents/foreman");
    createForemanAgent("postgres://mock-not-used-at-construction");
    expect(createZapierSdkSpy).not.toHaveBeenCalled();
  });

  it("does not call createZapierSdk when constructing the discovery agent", async () => {
    const { createDiscoveryAgent } = await import("../../src/mastra/agents/discovery");
    createDiscoveryAgent();
    expect(createZapierSdkSpy).not.toHaveBeenCalled();
  });

  it("does not call createZapierSdk when constructing the execution agent", async () => {
    const { createExecutionAgent } = await import("../../src/mastra/agents/execution");
    createExecutionAgent();
    expect(createZapierSdkSpy).not.toHaveBeenCalled();
  });
});
