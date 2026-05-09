import path from "node:path";
import { loadConfig, startFromConfig, LLMock } from "@copilotkit/aimock";

const PACKAGE_ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(PACKAGE_ROOT, "aimock.json");

let aimock: LLMock;

export default async function setup() {
  const config = loadConfig(CONFIG_PATH);
  // The fixtures path in aimock.json is relative to the package, not the
  // current working directory. Force-resolve it so tests work whether
  // they're invoked from packages/agents or from the workspace root.
  if (config.llm?.fixtures && !path.isAbsolute(config.llm.fixtures)) {
    config.llm.fixtures = path.resolve(PACKAGE_ROOT, config.llm.fixtures);
  }
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
