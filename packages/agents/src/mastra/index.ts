import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { createForemanAgent } from "./agents/foreman";
import customRoutes from "../routes";
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
    storage,
    server: {
      port: 4111,
      host: "0.0.0.0",
      middleware: [customMiddleware],
    },
  });

  return _mastra;
}
