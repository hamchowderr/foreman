import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * # Recurring schedules (from mastra-chat-kit's tools/schedule.ts, scoped per user)
 *
 * Wraps Mastra's native `mastra.schedules` service — cron-driven, persisted agent
 * schedules — as three agent tools. A schedule wakes the foreman agent with a prompt
 * on a cadence, into the conversation it was created in. That is different from an
 * Automation (a fixed Zapier durable workflow): a schedule re-plans with the model
 * on every fire.
 *
 * Foreman is multi-user, so unlike the kit every schedule is scoped to the resource
 * (user) that created it: `list_schedules` shows only the caller's schedules and
 * `stop_schedule` refuses another user's. Agent schedules carry no request context,
 * so a fired run's Zapier tools act as the schedule's resource (= the Foreman user
 * id; see lib/zapier-sdk-tools.ts).
 */

/** Agent id the schedules target — the key the foreman agent is registered under. */
export const SCHEDULE_AGENT_ID = "foreman";

/** Flat, JSON-safe view of an agent schedule for tool output + the schedules panel. */
const scheduleView = z.object({
  id: z.string(),
  cron: z.string(),
  prompt: z.string(),
  status: z.enum(["active", "paused"]),
  /** Epoch ms of the next planned fire (0 when paused/unknown). */
  nextFireAt: z.number(),
  name: z.string().optional(),
});
type ScheduleView = z.infer<typeof scheduleView>;

function toView(s: any): ScheduleView {
  return {
    id: String(s?.id ?? ""),
    cron: String(s?.cron ?? ""),
    prompt: String(s?.prompt ?? ""),
    status: s?.status === "paused" ? "paused" : "active",
    nextFireAt: typeof s?.nextFireAt === "number" ? s.nextFireAt : 0,
    ...(s?.name ? { name: String(s.name) } : {}),
  };
}

/** The caller's agent schedules (agent schedules carry an `agentId`). */
export async function listUserSchedules(schedules: any, resourceId: string): Promise<any[]> {
  const rows = await schedules.list({ agentId: SCHEDULE_AGENT_ID, resourceId });
  return (Array.isArray(rows) ? rows : []).filter(
    (s: any) => s?.agentId && s?.resourceId === resourceId,
  );
}

export const startScheduleTool = createTool({
  id: "start_schedule",
  description:
    'Create a recurring schedule that runs a prompt on a cron cadence and posts the result into THIS conversation. Call this when the user wants the assistant itself to do something repeatedly on a timer — "every morning check…", "remind me every hour…". For a fixed multi-step Zapier workflow that runs the same steps every time, use create_automation instead. Returns a schedule id the user can later pause with stop_schedule.',
  inputSchema: z.object({
    cron: z
      .string()
      .describe(
        'A cron expression for the cadence, e.g. "0 9 * * *" (daily at 09:00), "*/30 * * * *" (every 30 min).',
      ),
    prompt: z
      .string()
      .describe("The instruction to run each time the schedule fires (what the agent should do)."),
    name: z.string().optional().describe("Optional short label to distinguish this schedule."),
  }),
  outputSchema: scheduleView,
  execute: async ({ cron, prompt, name }, ctx) => {
    const schedules = ctx?.mastra?.schedules;
    const threadId = ctx?.agent?.threadId;
    const resourceId = ctx?.agent?.resourceId;
    if (!schedules) {
      throw new Error("Scheduling is unavailable in this context (no Mastra instance).");
    }
    if (!threadId || !resourceId) {
      throw new Error("A conversation thread is required to create a schedule.");
    }
    const created = await schedules.create({
      agentId: SCHEDULE_AGENT_ID,
      cron,
      prompt,
      threadId,
      resourceId,
      ...(name ? { name } : {}),
    });
    return toView(created);
  },
});

export const stopScheduleTool = createTool({
  id: "stop_schedule",
  description:
    "Pause a recurring schedule by id (from start_schedule or list_schedules). The schedule stops firing but is kept, so it can be resumed later. Call this when the user wants to stop or cancel a scheduled task.",
  inputSchema: z.object({
    scheduleId: z.string().describe("The schedule id to pause."),
  }),
  outputSchema: scheduleView,
  execute: async ({ scheduleId }, ctx) => {
    const schedules = ctx?.mastra?.schedules;
    const resourceId = ctx?.agent?.resourceId;
    if (!schedules || !resourceId) {
      throw new Error("Scheduling is unavailable in this context.");
    }
    const owned = await listUserSchedules(schedules, resourceId);
    if (!owned.some((s) => String(s.id) === scheduleId)) {
      throw new Error(`No schedule ${scheduleId} found for this user.`);
    }
    return toView(await schedules.pause(scheduleId));
  },
});

export const listSchedulesTool = createTool({
  id: "list_schedules",
  description:
    "List this user's recurring schedules, with their ids, cron cadence, prompt, and status. Read-only — use it to tell the user what's scheduled or to find a schedule id to pause.",
  inputSchema: z.object({}),
  outputSchema: z.object({ schedules: z.array(scheduleView) }),
  execute: async (_input, ctx) => {
    const schedules = ctx?.mastra?.schedules;
    const resourceId = ctx?.agent?.resourceId;
    if (!schedules || !resourceId) return { schedules: [] };
    return { schedules: (await listUserSchedules(schedules, resourceId)).map(toView) };
  },
});

export const scheduleTools = {
  start_schedule: startScheduleTool,
  stop_schedule: stopScheduleTool,
  list_schedules: listSchedulesTool,
};
