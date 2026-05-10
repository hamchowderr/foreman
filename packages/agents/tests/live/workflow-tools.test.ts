/**
 * Live integration tests for the workflow CRUD agent tools.
 *
 * Exercises save/list/get/update/delete against a real local Supabase.
 * run_workflow is NOT covered here because it would invoke real Zapier;
 * its execution path is unit-tested separately in workflow-tools-rud.test.ts.
 *
 * Each test seeds its own user + conversation + executed proposal rows,
 * runs the tool's execute() with a real RequestContext, and asserts
 * against the DB. Cleanup happens in afterAll.
 */
import { RequestContext } from "@mastra/core/request-context";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describe("workflow tools — live Supabase", () => {
  let reachable = false;
  let supabase: ReturnType<typeof createClient>;

  // Single user + conversation reused by tests, cleaned up in afterAll.
  // Unique per run so concurrent test runs don't collide.
  const testRunId = `wf-live-${Date.now()}`;
  const userId = `${testRunId}-user`;
  const conversationId = `${testRunId}-conv`;
  const createdWorkflowIds: string[] = [];

  beforeAll(async () => {
    reachable = await supabaseIsReachable();
    if (!reachable) {
      console.warn(
        `\n⚠  Supabase not reachable at ${SUPABASE_URL}. Skipping live workflow tests.\n` +
          `   Start it with: npx supabase start\n`,
      );
      return;
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Seed: user + conversation. Tests that need executed proposals will
    // insert them on-demand so we can vary the fixture per test.
    // NOTE: the `user` table uses camelCase columns (emailVerified, createdAt,
    // updatedAt) while every other table is snake_case. The TS UserRow interface
    // in schema.ts has the wrong shape.
    const now = new Date().toISOString();
    const { error: userErr } = await supabase.from("user").insert({
      id: userId,
      name: "live-test",
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
    // Cascade: delete in reverse-FK order. The DELETE /workflows/:id
    // cascade isn't FK-driven so we replicate it here for the test.
    for (const wfId of createdWorkflowIds) {
      await supabase.from("workflow_run").delete().eq("workflow_id", wfId);
      await supabase.from("workflow_step").delete().eq("workflow_id", wfId);
      await supabase.from("workflow").delete().eq("id", wfId);
    }
    await supabase.from("action_proposal").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation").delete().eq("id", conversationId);
    await supabase.from("user").delete().eq("id", userId);
  });

  /** Seed N executed proposals into the test conversation. Returns their ids. */
  async function seedExecutedProposals(
    specs: Array<{ app: string; action: string; inputs: Record<string, unknown> }>,
  ) {
    const ids: string[] = [];
    const now = Date.now();
    for (let i = 0; i < specs.length; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await supabase.from("action_proposal").insert({
        id,
        conversation_id: conversationId,
        mastra_run_id: null,
        app_key: specs[i].app,
        action_type: "write",
        action_key: specs[i].action,
        human_label: `${specs[i].app}.${specs[i].action}`,
        inputs: JSON.stringify(specs[i].inputs),
        input_schema: "{}",
        connection_id: null,
        status: "executed",
        // monotonically increasing so the saver preserves order
        created_at: new Date(now + i).toISOString(),
        updated_at: new Date(now + i).toISOString(),
      });
    }
    return ids;
  }

  it("save_workflow → list_workflows → get_workflow round-trip", async ({ skip }) => {
    if (!reachable) skip();

    await seedExecutedProposals([
      { app: "slack", action: "send_message", inputs: { channel: "#ops", text: "standup in 5" } },
      { app: "gmail", action: "send_email", inputs: { to: "team@acme.com", subject: "Heads up" } },
    ]);

    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const { listWorkflowsTool } = await import("@/mastra/tools/list-workflows");
    const { getWorkflowTool } = await import("@/mastra/tools/get-workflow");

    const saved = (await saveWorkflowTool.execute!(
      { name: "Standup post" } as any,
      ctx({ userId, conversationId }),
    )) as { workflowId: string; steps: number; parameters: string[] };

    expect(saved.workflowId).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.steps).toBe(2);
    expect(saved.parameters).toContain("to"); // 'team@acme.com' triggers the email pattern
    createdWorkflowIds.push(saved.workflowId);

    // Verify in DB directly
    const { data: dbRows } = await supabase
      .from("workflow_step")
      .select("order, proposal_template")
      .eq("workflow_id", saved.workflowId);
    expect(dbRows).toHaveLength(2);

    // list_workflows includes the new one
    const list = (await listWorkflowsTool.execute!({ limit: 20 } as any, ctx({ userId }))) as {
      workflows: Array<{ id: string; name: string }>;
    };

    expect(list.workflows.find((w) => w.id === saved.workflowId)).toMatchObject({
      name: "Standup post",
    });

    // get_workflow returns parsed steps in order
    const got = (await getWorkflowTool.execute!(
      { workflowId: saved.workflowId } as any,
      ctx({ userId }),
    )) as {
      id: string;
      steps: Array<{ order: number; appKey: string | null; actionKey: string | null }>;
    };

    expect(got.id).toBe(saved.workflowId);
    expect(got.steps).toHaveLength(2);
    expect(got.steps[0]).toMatchObject({ order: 0, appKey: "slack", actionKey: "send_message" });
    expect(got.steps[1]).toMatchObject({ order: 1, appKey: "gmail", actionKey: "send_email" });
  });

  it("update_workflow renames and toggles isTemplate", async ({ skip }) => {
    if (!reachable) skip();

    await seedExecutedProposals([
      { app: "slack", action: "send_message", inputs: { channel: "#x", text: "hi" } },
    ]);

    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const { updateWorkflowTool } = await import("@/mastra/tools/update-workflow");

    const saved = (await saveWorkflowTool.execute!(
      { name: "Original" } as any,
      ctx({ userId, conversationId }),
    )) as { workflowId: string };
    createdWorkflowIds.push(saved.workflowId);

    const renamed = (await updateWorkflowTool.execute!(
      { workflowId: saved.workflowId, name: "Renamed" } as any,
      ctx({ userId }),
    )) as { name: string; isTemplate: boolean };
    expect(renamed.name).toBe("Renamed");
    expect(renamed.isTemplate).toBe(false);

    const published = (await updateWorkflowTool.execute!(
      { workflowId: saved.workflowId, isTemplate: true } as any,
      ctx({ userId }),
    )) as { name: string; isTemplate: boolean };
    expect(published.name).toBe("Renamed"); // unchanged
    expect(published.isTemplate).toBe(true);
  });

  it("delete_workflow cascades to step + run rows", async ({ skip }) => {
    if (!reachable) skip();

    await seedExecutedProposals([
      { app: "slack", action: "send_message", inputs: { channel: "#del", text: "del" } },
    ]);

    const { saveWorkflowTool } = await import("@/mastra/tools/save-workflow");
    const { deleteWorkflowTool } = await import("@/mastra/tools/delete-workflow");

    const saved = (await saveWorkflowTool.execute!(
      { name: "To be deleted" } as any,
      ctx({ userId, conversationId }),
    )) as { workflowId: string };

    // Insert a fake workflow_run so we exercise the cascade
    await supabase.from("workflow_run").insert({
      id: crypto.randomUUID(),
      workflow_id: saved.workflowId,
      inputs: "{}",
      status: "success",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    const out = (await deleteWorkflowTool.execute!(
      { workflowId: saved.workflowId } as any,
      ctx({ userId }),
    )) as { deleted: true };
    expect(out.deleted).toBe(true);

    // All three tables should be empty for this workflow
    const { data: wf } = await supabase.from("workflow").select("id").eq("id", saved.workflowId);
    const { data: steps } = await supabase
      .from("workflow_step")
      .select("id")
      .eq("workflow_id", saved.workflowId);
    const { data: runs } = await supabase
      .from("workflow_run")
      .select("id")
      .eq("workflow_id", saved.workflowId);
    expect(wf).toEqual([]);
    expect(steps).toEqual([]);
    expect(runs).toEqual([]);
  });
});
