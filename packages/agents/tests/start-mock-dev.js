import path from "node:path";
import { spawn } from "node:child_process";

const AIMOCK_PORT = 4010;
const AIMOCK_URL = `http://localhost:${AIMOCK_PORT}`;
const CONFIG_PATH = path.join(import.meta.dirname, "..", "aimock.json");

async function main() {
  // Start aimock server via CLI
  const aimock = spawn(
    "npx",
    ["@copilotkit/aimock", "--config", CONFIG_PATH, "--port", String(AIMOCK_PORT)],
    { stdio: "inherit", shell: true },
  );

  // Wait for aimock to be ready
  await waitForServer(AIMOCK_URL);

  console.log(`aimock running at ${AIMOCK_URL}`);
  console.log(`ANTHROPIC_BASE_URL=${AIMOCK_URL}`);
  console.log(`OPENAI_BASE_URL=${AIMOCK_URL}/v1`);
  console.log("Starting mastra dev...\n");

  const child = spawn("npx", ["mastra", "dev"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: AIMOCK_URL,
      ANTHROPIC_API_KEY:
        process.env.ANTHROPIC_API_KEY || "sk-ant-mock-key-for-testing",
      OPENAI_BASE_URL: `${AIMOCK_URL}/v1`,
      OPENAI_API_KEY:
        process.env.OPENAI_API_KEY || "sk-mock-key-for-testing",
    },
  });

  const shutdown = () => {
    child.kill("SIGINT");
    aimock.kill("SIGINT");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  child.on("exit", (code) => {
    aimock.kill("SIGINT");
    process.exit(code ?? 0);
  });
}

async function waitForServer(url, retries = 30, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`aimock did not start at ${url} after ${retries} retries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
