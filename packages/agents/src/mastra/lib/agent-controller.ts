/**
 * # Foreman's Agent Controller (from mastra-chat-kit's lib/agent-controller.ts)
 *
 * Drives the `foreman` agent through Mastra's `AgentController`
 * (`@mastra/core/agent-controller`): per-user sessions and threads, Chat / Plan
 * modes, tool-approval gates, ask_user, task tracking and schedules, emitted as
 * `AgentControllerEvent`s that the web chat (the kit's `chat` block) renders. The
 * HTTP surface is the kit's route contract in ../routes; index.ts supplies the deps.
 *
 * What differs from the kit's reference server:
 *  - The backing agent is Foreman's own `foreman` agent (Zapier tools, custom tools).
 *  - The workspace is Foreman's PER-TENANT workspace (`buildForemanWorkspace`), passed
 *    as a per-request factory, so each workspace gets its own folder, knowledge index
 *    and isolated sandbox. The kit shares one workspace across every user.
 *  - Storage and memory are Foreman's Postgres (Supabase), not libSQL.
 *  - One Session per signed-in user (resource id = Foreman user id).
 *  - No browser (shared server-wide in the kit) and no subagents yet.
 */

import type { Agent } from "@mastra/core/agent";
import { AgentController, type Session } from "@mastra/core/agent-controller";
import type { MastraMemory } from "@mastra/core/memory";
import type { MastraCompositeStore } from "@mastra/core/storage";
import { buildForemanWorkspace } from "../agents/workspace";
import { scheduleTools } from "../tools/schedules";
import { AUTO_ALLOWED_TOOLS, PLAN_MODE_TOOLS, resolveToolCategory } from "./tool-categories";

/**
 * Plan mode's extra instructions. Mastra's submit_plan takes the PATH of a plan file the
 * agent wrote (never the plan text), so the agent writes it with the workspace's own
 * write_file tool first.
 */
export const PLAN_MODE_INSTRUCTIONS =
  "You are in PLAN mode. Investigate the request (look up the user's connected apps and the Zapier actions you would use) and produce a concise, ordered plan. Write it to a Markdown file under plans/ (e.g. plans/<short-name>.md) with mastra_workspace_write_file, then call submit_plan with that path. Run no actions in this mode — planning only. When the plan is approved, the session switches to Chat mode to execute it.";

let instance: AgentController | null = null;
let initPromise: Promise<AgentController> | null = null;

/**
 * Build the process-wide AgentController around the foreman agent, constructed but NOT
 * initialized. index.ts registers it on the Mastra instance (`agentControllers`) before
 * `init()` runs; an unregistered controller's init() would move the agent onto an
 * internal Mastra with no observability.
 */
export function createForemanAgentController(opts: {
  agent: Agent<any, any, any, any>;
  storage: MastraCompositeStore;
  memory: MastraMemory;
}): AgentController {
  instance = new AgentController({
    id: "foreman-agent-controller",
    defaultModeId: "chat",
    agent: opts.agent,
    // Without a resolver, "always allow" just approves once (Mastra has no default).
    toolCategoryResolver: resolveToolCategory,
    modes: [
      {
        id: "chat",
        name: "Chat",
        description: "Foreman — finds and runs actions across the user's connected apps.",
      },
      {
        id: "plan",
        name: "Plan",
        description: "Research and propose a plan; approving it switches to Chat to execute.",
        instructions: PLAN_MODE_INSTRUCTIONS,
        availableTools: [...PLAN_MODE_TOOLS],
        transitionsTo: "chat",
      },
    ],
    storage: opts.storage,
    memory: opts.memory,
    // Controller-level tools reach the agent on every controller run (and only there:
    // channel bots calling the agent directly don't get them).
    tools: scheduleTools,
    // Per-tenant: resolved from the run's request context (workspaceId / userId).
    workspace: buildForemanWorkspace,
  });
  return instance;
}

/** The registered controller instance (throws if index.ts hasn't built it yet). */
export function getForemanAgentControllerInstance(): AgentController {
  if (!instance) throw new Error("Foreman AgentController not created yet (see mastra/index.ts)");
  return instance;
}

/** Lazily `init()` the process-wide AgentController exactly once. */
export function getForemanAgentController(): Promise<AgentController> {
  initPromise ??= (async () => {
    const controller = getForemanAgentControllerInstance();
    await controller.init();
    return controller;
  })();
  return initPromise;
}

/**
 * Get-or-create the Session for one user, so /agent-controller/stream and /approve drive
 * the SAME session (an approval must resolve on the session that parked at the gate).
 */
export async function getForemanSession(resourceId?: string): Promise<Session> {
  if (!resourceId) throw new Error("A signed-in user is required");
  const controller = await getForemanAgentController();
  const existing = await controller.getSessionByResource(resourceId);
  const session = existing ?? (await controller.createSession({ resourceId }));
  // In-memory + idempotent, so re-granting each call is free.
  for (const tool of AUTO_ALLOWED_TOOLS) {
    session.grantTool(tool);
  }
  return session;
}
