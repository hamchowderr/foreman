/**
 * Live integration tests for the workflow trigger tools.
 *
 * Mirrors workflow-tools.test.ts: seeds user + conversation + executed
 * proposals, calls save_workflow to get a real workflow, then exercises
 * attach/list/detach against the real workflow_trigger table.
 */
import { RequestContext } from "@mastra/core/request-context";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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

describe("workflow trigger tools — live Supabase", () => {
  let reachable = false;
  let supabase: ReturnType<typeof createClient<Database>>;

  const testRunId = `wf-trig-${Date.now()}`;
  const userId = `${testRunId}-user`;
  const conversationId = `${testRunId}-conv`;
  const createdWorkflowIds: string[] = [];

  beforeAll(async () => {
    reachable = await supabaseIsReachable();
    if (!reachable) {
      console.warn(
        `\n⚠  Supabase not reachable at ${SUPABASE_URL}. Skipping live trigger tests.\n`,
      );
      return;
    }
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date().toISOString();
    const { error: userErr } = await supabase.from("user").insert({
      id: userId,
      name: "live-trigger-test",
      email: `${testRunId}@test.local`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
    if (userErr) throw new Error(`seed user failed: ${userErr.message}`);
    const { error: convErr } = await supabase.from("conversation").insert({
      id: conversationId,
      user_id: userId,
      mastra_thread_id: null,
      title: null,
      created_at: now,
      updated_at: now,
    });
    if (convErr) throw new Error(`seed conversation failed: ${convErr.message}`);
  });

  afterAll(async () => {
    if (!reachable) return;
    for (const wfId of createdWorkflowIds) {
      await supabase.from("workflow_trigger").delete().eq("workflow_id", wfId);
      await supabase.from("workflow_step").delete().eq("workflow_id", wfId);
      await supabase.from("workflow").delete().eq("id", wfId);
    }
    await supabase.from("action_proposal").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation").delete().eq("id", conversationId);
    await supabase.from("user").delete().eq("id", userId);
  });

  async function seedWorkflow(name: string): Promise<string> {
    const now = Date.now();
    await supabase.from("action_proposal").insert({
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      mastra_run_id: null,
      app_key: "slack",
      action_type: "write",
      action_key: "send_message",
      human_label: "slack.send_message",
      inputs: JSON.stringify({ channel: "#ops", text: "hi" }),
      input_schema: "{}",
      connection_id: null,
      status: "executed",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const saved = (await saveWorkflowTool.execute!(
      { name } as any,
      ctx({ userId, conversationId }),
    )) as { workflowId: string };
    createdWorkflowIds.push(saved.workflowId);
    return saved.workflowId;
  }

  it("attach_trigger → list_workflow_triggers → detach_trigger round-trip (cron)", async ({
    skip,
  }) => {
    if (!reachable) skip();
    const workflowId = await seedWorkflow("Cron trigger test");

    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const { listWorkflowTriggersTool } = await import("@/mastra/tools/list-workflow-triggers");
    const { detachTriggerTool } = await import("@/mastra/tools/detach-trigger");

    const attached = (await attachTriggerTool.execute!(
      {
        workflowId,
        type: "cron",
        cron: { schedule: "0 9 * * 1-5", timezone: "America/Los_Angeles" },
      } as any,
      ctx({ userId }),
    )) as { id: string; type: string; enabled: boolean };

    expect(attached.type).toBe("cron");
    expect(attached.enabled).toBe(true);

    // Verify in DB directly
    const { data: dbRow } = await supabase
      .from("workflow_trigger")
      .select("id, type, config")
      .eq("id", attached.id)
      .maybeSingle();
    expect(dbRow).toMatchObject({ type: "cron" });
    expect(JSON.parse(dbRow?.config as string)).toMatchObject({
      schedule: "0 9 * * 1-5",
      timezone: "America/Los_Angeles",
    });

    const list = (await listWorkflowTriggersTool.execute!(
      { workflowId } as any,
      ctx({ userId }),
    )) as { triggers: Array<{ id: string; type: string; config: any }> };
    expect(list.triggers).toHaveLength(1);
    expect(list.triggers[0]).toMatchObject({ id: attached.id, type: "cron" });
    expect(list.triggers[0].config).toMatchObject({ schedule: "0 9 * * 1-5" });

    const detached = (await detachTriggerTool.execute!(
      { workflowId, triggerId: attached.id } as any,
      ctx({ userId }),
    )) as { deleted: true };
    expect(detached.deleted).toBe(true);

    const after = (await listWorkflowTriggersTool.execute!(
      { workflowId } as any,
      ctx({ userId }),
    )) as { triggers: any[] };
    expect(after.triggers).toEqual([]);
  });

  it("attach_trigger persists a channel trigger", async ({ skip }) => {
    if (!reachable) skip();
    const workflowId = await seedWorkflow("Channel trigger test");

    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const attached = (await attachTriggerTool.execute!(
      {
        workflowId,
        type: "channel",
        channel: { channel: "slack", match: { command: "!standup", room: "#ops" } },
      } as any,
      ctx({ userId }),
    )) as { id: string; type: string };

    expect(attached.type).toBe("channel");

    const { data: dbRow } = await supabase
      .from("workflow_trigger")
      .select("type, config")
      .eq("id", attached.id)
      .maybeSingle();
    expect(JSON.parse(dbRow?.config as string)).toMatchObject({
      channel: "slack",
      match: { command: "!standup", room: "#ops" },
    });
  });

  it("workflow delete cascades to triggers", async ({ skip }) => {
    if (!reachable) skip();
    const workflowId = await seedWorkflow("Cascade trigger test");

    const { attachTriggerTool } = await import("@/mastra/tools/attach-trigger");
    const attached = (await attachTriggerTool.execute!(
      {
        workflowId,
        type: "cron",
        cron: { schedule: "0 * * * *" },
      } as any,
      ctx({ userId }),
    )) as { id: string };

    // Delete the parent workflow directly
    await supabase.from("workflow_step").delete().eq("workflow_id", workflowId);
    await supabase.from("workflow").delete().eq("id", workflowId);

    const { data: orphan } = await supabase
      .from("workflow_trigger")
      .select("id")
      .eq("id", attached.id);
    expect(orphan).toEqual([]);
  });
});
