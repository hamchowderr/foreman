const path = require("node:path");
const { spawn } = require("node:child_process");
const { LLMock } = require("@copilotkit/aimock");

const LLMOCK_PORT = 5555;
const FIXTURE_DIR = path.join(__dirname, "fixtures", "llmock");

async function main() {
  const mock = new LLMock({ port: LLMOCK_PORT, logLevel: "info" });
  mock.loadFixtureDir(FIXTURE_DIR);
  const url = await mock.start();
  const baseUrl = `${url}/v1`;

  console.log(`LLMock running at ${url}`);
  console.log(`ANTHROPIC_BASE_URL=${baseUrl}`);
  console.log("Starting next dev...\n");

  const child = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "sk-ant-mock-key-for-testing",
    },
  });

  const shutdown = async () => {
    child.kill("SIGINT");
    await mock.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  child.on("exit", (code) => {
    mock.stop().then(() => process.exit(code ?? 0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
