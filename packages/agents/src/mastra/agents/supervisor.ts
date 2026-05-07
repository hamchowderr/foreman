import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";
import { contextInjector, piiRedactor } from "../../lib/processors";
import { AGENT_MODELS, modelSettingsFor, onFinishCostLogger, systemPromptFor } from "../../lib/providers";

const SUPERVISOR_PROMPT = `You are Foreman Supervisor, an AI assistant that helps users take actions across 9000+ apps via Zapier. You coordinate specialist agents to fulfill user requests.

You have three specialist agents available as tools:
- **agent-discovery**: Discovers connected apps, lists available actions, retrieves schemas and field choices. Use for any "what can I do?" or "what's connected?" questions.
- **agent-execution**: Executes Zapier actions, makes raw API calls, connects Zapier accounts. Use when the user wants to actually do something.
- **agent-history**: Searches past action history, finds patterns, recommends based on previous usage. Use when the user asks about past actions or wants suggestions.

Routing guidelines:
1. For discovery-only requests (listing apps, exploring actions, checking schemas), delegate to agent-discovery.
2. For execution requests, first delegate to agent-discovery to resolve the action schema, then delegate to agent-execution with the resolved details.
3. For history/recommendation requests, delegate to agent-history.
4. For multi-step flows (e.g., "send an email to X"), orchestrate across agents: discover the action schema, then execute.
5. Always synthesize subagent results into a clear, user-friendly response.

Never expose internal agent names to the user. Present yourself as "Foreman".`;

interface SupervisorDeps {
  databaseUrl: string;
  discoveryAgent: Agent;
  executionAgent: Agent;
  historyAgent: Agent;
}

export function createSupervisorAgent({ databaseUrl, discoveryAgent, executionAgent, historyAgent }: SupervisorDeps) {
  return new Agent({
    id: "supervisor",
    name: "Foreman Supervisor",
    description:
      "Supervisor agent that routes requests to specialist subagents for discovery, execution, and history analysis.",
    instructions: systemPromptFor("supervisor", SUPERVISOR_PROMPT),
    model: AGENT_MODELS.supervisor,
    defaultOptions: {
      modelSettings: modelSettingsFor("supervisor"),
      onFinish: onFinishCostLogger("supervisor"),
    },
    agents: {
      discovery: discoveryAgent,
      execution: executionAgent,
      history: historyAgent,
    },
    inputProcessors: [contextInjector],
    outputProcessors: [piiRedactor],
    memory: new Memory({
      storage: new PostgresStore({
        id: "supervisor-memory",
        connectionString: databaseUrl,
      }),
      vector: new PgVector({
        id: "supervisor-memory-vector",
        connectionString: databaseUrl,
      }),
      embedder: "openai/text-embedding-3-small",
      options: {
        lastMessages: 20,
        workingMemory: { enabled: true },
        semanticRecall: {
          topK: 4,
          messageRange: 2,
        },
        observationalMemory: true,
      },
    }),
  });
}
