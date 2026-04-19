import path from "node:path";
import { loadConfig, startFromConfig, LLMock } from "@copilotkit/aimock";

const CONFIG_PATH = path.join(__dirname, "..", "aimock.json");

let aimock: LLMock;

export default async function setup() {
  const config = loadConfig(CONFIG_PATH);
  const { aimock: instance, url } = await startFromConfig(config, { port: 0 });
  aimock = instance;

  // Matches AIMock's official Vitest plugin (`useAimock`) — both providers
  // get `/v1` appended. Mastra's bundled Anthropic SDK uses
  // api.anthropic.com/v1 as its default base and appends /messages, so the
  // mock base URL must include /v1 too.
  process.env.ANTHROPIC_BASE_URL = `${url}/v1`;
  process.env.OPENAI_BASE_URL = `${url}/v1`;
  // Store for teardown
  (globalThis as Record<string, unknown>).__aimock = aimock;
}

export async function teardown() {
  if (aimock) {
    await aimock.stop();
  }
}
