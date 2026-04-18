import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { createForemanAgent } from "./agents/foreman";
import { dailySummaryWorkflow } from "../workflows/daily-summary";
import { healthCheckWorkflow } from "../workflows/health-check";
import customRoutes from "../routes";
import type { MiddlewareHandler } from "hono";

let _mastra: Mastra | undefined;

async function loadDeployer() {
  if (process.env.DEPLOY_TARGET === "vercel") {
    const { VercelDeployer } = await import("@mastra/deployer-vercel");
    return new VercelDeployer({ studio: true });
  }
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { CloudflareDeployer } = await import("@mastra/deployer-cloudflare");
    return new CloudflareDeployer({ name: "foreman-agents" });
  }
  return undefined; // VPS: no deployer, standalone Hono server
}

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  const storage = new LibSQLStore({
    id: "foreman-storage",
    url: databaseUrl,
  });

  const foremanAgent = createForemanAgent(databaseUrl);

  // Mount the custom Hono app as middleware so it handles
  // /conversations/* and /proposals/* alongside Mastra's built-in /api/* routes.
  const customMiddleware: MiddlewareHandler = async (c, next) => {
    const response = await customRoutes.fetch(c.req.raw);
    if (response.status !== 404) {
      return response;
    }
    await next();
  };

  _mastra = new Mastra({
    agents: {
      foreman: foremanAgent,
    },
    workflows: {
      "daily-summary": dailySummaryWorkflow,
      "health-check": healthCheckWorkflow,
    },
    storage,
    server: {
      port: Number(process.env.PORT) || 4111,
      host: "0.0.0.0",
      middleware: [customMiddleware],
    },
  });

  return _mastra;
}

// For Vercel/Cloudflare builds: export the Mastra instance with deployer
// Usage: DEPLOY_TARGET=vercel mastra build
export async function createMastraWithDeployer() {
  const deployer = await loadDeployer();
  const mastra = getMastra();
  if (deployer) {
    // @ts-expect-error deployer is set after construction for build-time only
    mastra.deployer = deployer;
  }
  return mastra;
}

// Default export for mastra build
export const mastra = getMastra();
