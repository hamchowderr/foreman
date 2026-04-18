import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { Observability, ConsoleExporter, DefaultExporter } from "@mastra/observability";
import { createForemanAgent } from "./agents/foreman";
import { createDiscoveryAgent } from "./agents/discovery";
import { createExecutionAgent } from "./agents/execution";
import { createHistoryAgent } from "./agents/history";
import { createSupervisorAgent } from "./agents/supervisor";
import { webhookHandlerWorkflow } from "../workflows/webhook-handler";
import type { MiddlewareHandler } from "hono";

let _mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  const storage = new LibSQLStore({
    id: "foreman-storage",
    url: databaseUrl,
  });

  const foremanAgent = createForemanAgent(databaseUrl);
  const discoveryAgent = createDiscoveryAgent();
  const executionAgent = createExecutionAgent();
  const historyAgent = createHistoryAgent();
  const supervisorAgent = createSupervisorAgent(databaseUrl);

  // Lazy-load routes to break circular dependency
  // Routes import getMastra() but only call it inside handlers (not at import time)
  const customMiddleware: MiddlewareHandler = async (c, next) => {
    const { default: customRoutes } = await import("../routes");
    const response = await customRoutes.fetch(c.req.raw);
    if (response.status !== 404) {
      return response;
    }
    await next();
  };

  const otelEnabled = process.env.OTEL_ENABLED === "true";

  const observability = otelEnabled
    ? new Observability({
        configs: {
          default: {
            serviceName: "foreman-agents",
            exporters: [new DefaultExporter(), new ConsoleExporter()],
          },
        },
      })
    : undefined;

  _mastra = new Mastra({
    agents: {
      foreman: foremanAgent,
      discovery: discoveryAgent,
      execution: executionAgent,
      history: historyAgent,
      supervisor: supervisorAgent,
    },
    workflows: {
      webhookHandler: webhookHandlerWorkflow,
    },
    storage,
    observability,
    server: {
      port: Number(process.env.PORT) || 4111,
      host: "0.0.0.0",
      middleware: [customMiddleware],
    },
  });

  return _mastra;
}

// Default export for mastra build
export const mastra = getMastra();
