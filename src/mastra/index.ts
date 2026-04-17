import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { createForemanAgent } from "./agents/foreman";

let _mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  const databaseUrl = process.env.DATABASE_URL!;

  const storage = new LibSQLStore({
    id: "foreman-storage",
    url: databaseUrl,
  });

  const foremanAgent = createForemanAgent(databaseUrl);

  _mastra = new Mastra({
    agents: {
      foreman: foremanAgent,
    },
    storage,
  });

  return _mastra;
}
