import type { ToolCategory } from "@mastra/core/agent-controller";
import { resolveToolCategory } from "./tool-categories";

/**
 * # "Always allow" for scheduled runs
 *
 * Mastra keeps an "Always allow" decision in the live Session only, and a Session
 * only watches the thread the user has open. A scheduled fire into any other
 * thread (or after a restart) would park on an approval card nobody sees, so the
 * schedule's work queues up behind it.
 *
 * So Foreman also writes each "Always allow" into the thread's metadata, and a
 * scheduled run (its request context carries the schedule's thread, see
 * tools/schedules.ts) skips approval for a workspace tool whose category the
 * user already allowed in that thread. Uncategorized tools (Zapier writes,
 * deletes, schedule and automation changes) are never granted, so they still ask.
 */

/** Thread-metadata key holding the categories allowed in that thread. */
export const ALWAYS_ALLOW_METADATA_KEY = "foremanAlwaysAllow";

/** Request-context key a scheduled run carries: the thread the schedule wakes. */
export const SCHEDULE_THREAD_KEY = "scheduleThreadId";

type ThreadStore = {
  getThreadById(args: { threadId: string }): Promise<{
    id: string;
    title?: string;
    metadata?: Record<string, unknown> | null;
  } | null>;
  updateThread(args: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
};

let store: ThreadStore | null = null;

/** index.ts hands over the foreman Memory once it exists. */
export function setScheduleGrantStore(memory: ThreadStore | null): void {
  store = memory;
}

function categoriesOf(metadata: Record<string, unknown> | null | undefined): ToolCategory[] {
  const value = metadata?.[ALWAYS_ALLOW_METADATA_KEY];
  return Array.isArray(value) ? (value.filter((v) => typeof v === "string") as ToolCategory[]) : [];
}

/** The categories the user chose "Always allow" for in `threadId`. */
export async function threadAlwaysAllows(threadId: string): Promise<ToolCategory[]> {
  if (!store) return [];
  const thread = await store.getThreadById({ threadId });
  return categoriesOf(thread?.metadata);
}

/** Remember an "Always allow" on `toolName` (by its category) for `threadId`. */
export async function recordAlwaysAllow(threadId: string, toolName: string): Promise<void> {
  const category = resolveToolCategory(toolName);
  if (!store || !category) return;
  const thread = await store.getThreadById({ threadId });
  if (!thread) return;
  const current = categoriesOf(thread.metadata);
  if (current.includes(category)) return;
  await store.updateThread({
    id: thread.id,
    title: thread.title,
    metadata: { ...thread.metadata, [ALWAYS_ALLOW_METADATA_KEY]: [...current, category] },
  });
}

/**
 * A workspace tool's `requireApproval`: always ask, except in a scheduled run whose
 * thread already has "Always allow" for the tool's category.
 */
export function approvalUnlessScheduledGrant(toolName: string) {
  return async ({
    requestContext,
  }: {
    requestContext?: { get(key: string): unknown } | Record<string, unknown>;
  }): Promise<boolean> => {
    const threadId = readContext(requestContext, SCHEDULE_THREAD_KEY);
    const category = resolveToolCategory(toolName);
    if (typeof threadId !== "string" || !threadId || !category) return true;
    try {
      return !(await threadAlwaysAllows(threadId)).includes(category);
    } catch {
      // Can't read the grant: ask, as an unscheduled run would.
      return true;
    }
  };
}

function readContext(
  requestContext: { get(key: string): unknown } | Record<string, unknown> | undefined,
  key: string,
): unknown {
  if (!requestContext) return undefined;
  if (typeof (requestContext as { get?: unknown }).get === "function") {
    return (requestContext as { get(key: string): unknown }).get(key);
  }
  return (requestContext as Record<string, unknown>)[key];
}
