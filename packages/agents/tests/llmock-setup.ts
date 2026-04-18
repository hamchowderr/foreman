import path from "node:path";
import { LLMock } from "@copilotkit/aimock";

const LLMOCK_PORT = 5555;
const FIXTURE_DIR = path.join(__dirname, "fixtures", "llmock");

export const mock = new LLMock({ port: LLMOCK_PORT, logLevel: "silent" });

// Playwright globalSetup — default export
export default async function setup() {
  mock.loadFixtureDir(FIXTURE_DIR);
  const url = await mock.start();
  process.env.ANTHROPIC_BASE_URL = `${url}/v1`;
  // Store for teardown
  (globalThis as Record<string, unknown>).__llmock = mock;
}

export async function teardown() {
  await mock.stop();
}
