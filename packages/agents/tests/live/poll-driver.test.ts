/**
 * Live integration test for the poll driver (foreman-ueep).
 *
 * Exercises the full poll-trigger path against REAL local Supabase:
 *   attach_trigger(type='poll') → zapierPollProvider.runDuePolls() →
 *   executeWorkflow → workflow_run rows.
 *
 * The only thing stubbed is the external Zapier read (`runAction`): the local DB
 * was reset and there's no OAuth-connected app to create records in, so we
 * control what the "read" returns (and stub the workflow's write step so
 * executeWorkflow completes). Everything else — cursor persistence, firing,
 * dedup, workflow_run inserts with fired_by/trigger_id — is real Postgres.
 *
 * Auto-skips if Supabase isn't reachable. Run: npm run test:live
 */
import { RequestContext } from "@mastra/core/request-context";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db/database.types";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Control the Zapier read the poll driver sees; stub the workflow's write step.
let readRecords: Array<Record<string, unknown>> = [];
vi.mock("@/lib/zapier/execution", () => ({
  runAction: vi.fn(async (_userId: string, _app: string, actionType: string) =>
    actionType === "read" ? { data: readRecords } : { ok: true },
  ),
  rawFetch: vi.fn(),
}));

async function supabaseIsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

function ctx({ userId, conversationId }: { userId: string; conversationId?: string }) {
  const entries: [string, string][] = [["userId", userId]];
  if (conversationId) entries.push(["threadId", conversationId]);
  return { requestContext: new RequestContext(entries) } as any;
}

describe("poll driver — live Supabase (foreman-ueep)", () => {
  let reachable = false;
  let supabase: ReturnType<typeof createClient<Database>>;

  const testRunId = `poll-${Date.now()}`;
  const userId = `${testRunId}-user`;
  const conversationId = `${testRunId}-conv`;
  let workflowId = "";
  let triggerId = "";

  async function runsForWorkflow() {
    const { data } = await supabase.from("workflow_run").select("*").eq("workflow_id", workflowId);
    return data ?? [];
  }
  async function triggerRow() {
    const { data } = await supabase
      .from("workflow_trigger")
      .select("last_dedupe_key, last_fired_at")
      .eq("id", triggerId)
      .maybeSingle();
    return data;
  }

  beforeAll(async () => {
    reachable = await supabaseIsReachable();
    if (!reachable) {
      console.warn(`\n⚠  Supabase not reachable at ${SUPABASE_URL}. Skipping live poll tests.\n`);
      return;
    }
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    await supabase.from("user").insert({
      id: userId,
      name: "live-poll-test",
      email: `${testRunId}@test.local`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
    await supabase.from("conversation").insert({
      id: conversationId,
      user_id: userId,
      mastra_thread_id: null,
      title: null,
      created_at: now,
      updated_at: now,
    });
    // An executed proposal → save_workflow turns it into a real workflow + step.
    await supabase.from("action_proposal").insert({
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      mastra_run_id: null,
      app_key: "slack",
      action_type: "write",
      action_key: "send_message",
      human_label: "slack.send_message",
      inputs: JSON.stringify({ channel: "#ops", text: "poll fired" }),
      input_schema: "{}",
      connection_id: null,
      status: "executed",
      created_at: now,
      updated_at: now,
    });

    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const saved = (await saveWorkflowTool.execute!(
      { name: "Live poll workflow" } as any,
      ctx({ userId, conversationId }),
    )) as { workflowId: string };
    workflowId = saved.workflowId;

    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const attached = (await attachTriggerTool.execute!(
      {
        workflowId,
        type: "poll",
        poll: { app: "gmail", action: "new_email", dedupeKey: "id", intervalMinutes: 5 },
      } as any,
      ctx({ userId }),
    )) as { id: string; type: string };
    triggerId = attached.id;
    expect(attached.type).toBe("poll");
  });

  afterAll(async () => {
    if (!reachable) return;
    await supabase.from("workflow_run").delete().eq("workflow_id", workflowId);
    await supabase.from("workflow_trigger").delete().eq("workflow_id", workflowId);
    await supabase.from("workflow_step").delete().eq("workflow_id", workflowId);
    await supabase.from("workflow").delete().eq("id", workflowId);
    await supabase.from("action_proposal").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation").delete().eq("id", conversationId);
    await supabase.from("user").delete().eq("id", userId);
  });

  it("persists the poll trigger config", async ({ skip }) => {
    if (!reachable) skip();
    const { data } = await supabase
      .from("workflow_trigger")
      .select("type, config")
      .eq("id", triggerId)
      .maybeSingle();
    expect(data?.type).toBe("poll");
    expect(JSON.parse(data?.config as string)).toMatchObject({
      app: "gmail",
      action: "new_email",
      dedupeKey: "id",
    });
  });

  it("first poll establishes the baseline — fires nothing, sets the cursor", async ({ skip }) => {
    if (!reachable) skip();
    readRecords = [{ id: "2" }, { id: "1" }];
    const { zapierPollProvider } = await import("@/mastra/signals/zapier-poll-provider");
    const out = await zapierPollProvider.runDuePolls(new Date("2026-06-12T12:00:00Z"));

    expect(out.fired).toBe(0);
    expect(await runsForWorkflow()).toHaveLength(0);
    expect((await triggerRow())?.last_dedupe_key).toBe("2");
  });

  it("fires the workflow once for a new record, recording fired_by=poll + trigger_id", async ({
    skip,
  }) => {
    if (!reachable) skip();
    readRecords = [{ id: "3" }, { id: "2" }, { id: "1" }]; // "3" is new
    const { zapierPollProvider } = await import("@/mastra/signals/zapier-poll-provider");
    const out = await zapierPollProvider.runDuePolls(new Date("2026-06-12T12:10:00Z"));

    expect(out.fired).toBe(1);
    const runs = await runsForWorkflow();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ fired_by: "poll", trigger_id: triggerId, status: "success" });
    expect((await triggerRow())?.last_dedupe_key).toBe("3");
  });

  it("does not double-fire when no new record appears (dedup)", async ({ skip }) => {
    if (!reachable) skip();
    readRecords = [{ id: "3" }, { id: "2" }]; // newest "3" == cursor
    const { zapierPollProvider } = await import("@/mastra/signals/zapier-poll-provider");
    const out = await zapierPollProvider.runDuePolls(new Date("2026-06-12T12:20:00Z"));

    expect(out.fired).toBe(0);
    expect(await runsForWorkflow()).toHaveLength(1); // still just the one
  });
});
