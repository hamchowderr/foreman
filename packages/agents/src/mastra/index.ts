import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { MastraAuthClerk } from "@mastra/auth-clerk";
import { Observability, ConsoleExporter, DefaultExporter } from "@mastra/observability";
import { chatRoute } from "@mastra/ai-sdk";
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
  const supervisorAgent = createSupervisorAgent({
    databaseUrl,
    discoveryAgent,
    executionAgent,
    historyAgent,
  });

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
      apiRoutes: [
        // Mastra's built-in chat route — handles streaming, tool approval/resume, memory
        chatRoute({
          path: "/chat/:agentId",
          defaultOptions: {
            maxSteps: 15,
          },
        }),
      ],
      auth: new MastraAuthClerk({
        publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
        secretKey: process.env.CLERK_SECRET_KEY,
      }),
    },
  });

  return _mastra;
}

// Default export for mastra build
export const mastra = getMastra();
