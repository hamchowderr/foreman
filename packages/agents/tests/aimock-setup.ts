import path from "node:path";
import { loadConfig, startFromConfig, LLMock } from "@copilotkit/aimock";

const CONFIG_PATH = path.join(__dirname, "..", "aimock.json");

let aimock: LLMock;

export default async function setup() {
  const config = loadConfig(CONFIG_PATH);
  const { aimock: instance, url } = await startFromConfig(config, { port: 0 });
  aimock = instance;

  // Anthropic SDK expects base URL without /v1 — aimock serves /v1/messages natively
  process.env.ANTHROPIC_BASE_URL = url;
  process.env.OPENAI_BASE_URL = `${url}/v1`;
  // Store for teardown
  (globalThis as Record<string, unknown>).__aimock = aimock;
}

export async function teardown() {
  if (aimock) {
    await aimock.stop();
  }
}
