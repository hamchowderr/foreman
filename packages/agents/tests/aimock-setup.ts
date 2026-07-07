import path from "node:path";
import { type LLMock, loadConfig, startFromConfig } from "@copilotkit/aimock";

const PACKAGE_ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(PACKAGE_ROOT, "aimock.json");

let aimock: LLMock;

/**
 * Foreman's aimock.json declares LLM, MCP, and A2A fixtures — AIMock's
 * documented suite API is `loadConfig + startFromConfig`
 * (@copilotkit/aimock/dist/config-loader.d.ts), used here via Vitest's
 * `globalSetup` hook so the server is reused across every test file.
 *
 * The `/v1` suffix on both base URLs is required by the SDKs, not by AIMock:
 *   - Anthropic SDK base URL defaults to https://api.anthropic.com/v1 and
 *     appends `/messages` (Mastra bundle, chunk-3RIGZMZ5.js:14199).
 *   - OpenAI SDK defaults to https://api.openai.com/v1 and appends
 *     `/responses` or `/chat/completions`.
 * If the env var omits `/v1`, the SDK hits `/messages` on the mock root and
 * gets a 404 from AIMock's `/v1/messages` handler.
 *
 * AIMock's Vitest plugin (`useAimock`) is LLM-only — it starts `LLMock`
 * alone, not `MockSuite`. Using it here would silently drop MCP and A2A
 * mocking, so the documented suite-level API is the correct path.
 */
export default async function setup() {
  const config = loadConfig(CONFIG_PATH);
  // The fixtures path in aimock.json is relative to the package, not the
  // current working directory. Force-resolve it so tests work whether
  // they're invoked from packages/agents or from the workspace root.
  if (config.llm?.fixtures && !path.isAbsolute(config.llm.fixtures)) {
    config.llm.fixtures = path.resolve(PACKAGE_ROOT, config.llm.fixtures);
  }
  const { llmock: instance, url } = await startFromConfig(config, { port: 0 });
  aimock = instance;

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
