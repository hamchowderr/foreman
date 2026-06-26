/**
 * Unit tests for the automation store (foreman-l7xq M2). Mocks the Supabase
 * client; asserts insert shape, workspace scoping, and the idempotent inbox claim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let nextResult: { data: unknown; error: unknown } = { data: null, error: null };
let lastInsert: Record<string, unknown> | null = null;
let lastTable: string | null = null;

function createChain() {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "update", "delete"]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    lastInsert = payload;
    return builder;
  });
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(nextResult));
  // biome-ignore lint/suspicious/noThenProperty: deliberate — makes the query builder awaitable
  builder.then = (resolve: (v: unknown) => unknown) => resolve(nextResult);
  return builder;
}

const mockSupabase = {
  from: vi.fn((t: string) => {
    lastTable = t;
    return createChain();
  }),
};

vi.mock("@/lib/db", () => ({ getSupabase: () => mockSupabase }));

import {
  claimInboxMessage,
  createAutomation,
  getAutomationByZapierWorkflowId,
  listAutomations,
} from "@/lib/automations/store";

describe("createAutomation", () => {
  beforeEach(() => {
    nextResult = { data: null, error: null };
    lastInsert = null;
    lastTable = null;
  });

  it("inserts a workspace-scoped row with sane defaults", async () => {
    const id = await createAutomation({
      userId: "user-1",
      workspaceId: "ws-1",
      name: "Notify",
      source: "SRC",
      zapierWorkflowId: "wf_1",
      zapierVersionId: "ver_1",
    });
    expect(typeof id).toBe("string");
    expect(lastTable).toBe("automation");
    expect(lastInsert).toMatchObject({
      user_id: "user-1",
      workspace_id: "ws-1",
      name: "Notify",
      zapier_workflow_id: "wf_1",
      zapier_version_id: "ver_1",
      source: "SRC",
      connections: {},
      trigger: null,
      enabled: false,
      status: "active",
    });
  });

  it("throws when the insert errors", async () => {
    nextResult = { data: null, error: { message: "boom" } };
    await expect(
      createAutomation({
        userId: "u",
        workspaceId: "ws-1",
        name: "n",
        source: "s",
        zapierWorkflowId: "wf",
      }),
    ).rejects.toThrow(/createAutomation failed: boom/);
  });
});

describe("listAutomations", () => {
  beforeEach(() => {
    nextResult = { data: null, error: null };
  });

  it("returns rows for a workspace", async () => {
    nextResult = { data: [{ id: "a1" }, { id: "a2" }], error: null };
    const rows = await listAutomations("ws-1");
    expect(rows).toHaveLength(2);
  });

  it("returns empty (no query) when no workspace", async () => {
    const rows = await listAutomations(undefined);
    expect(rows).toEqual([]);
  });
});

describe("claimInboxMessage — idempotency", () => {
  beforeEach(() => {
    nextResult = { data: null, error: null };
    lastInsert = null;
  });

  it("claims a fresh message (returns a run id)", async () => {
    nextResult = { data: { id: "row" }, error: null };
    const id = await claimInboxMessage({
      automationId: "a1",
      workspaceId: "ws-1",
      inboxMessageId: "m1",
    });
    expect(typeof id).toBe("string");
    expect(lastInsert).toMatchObject({
      automation_id: "a1",
      inbox_message_id: "m1",
      status: "initialized",
    });
  });

  it("returns null on a unique-violation (already claimed → skip)", async () => {
    nextResult = { data: null, error: { code: "23505", message: "duplicate key" } };
    const id = await claimInboxMessage({
      automationId: "a1",
      workspaceId: "ws-1",
      inboxMessageId: "m1",
    });
    expect(id).toBeNull();
  });

  it("rethrows non-conflict errors", async () => {
    nextResult = { data: null, error: { code: "42P01", message: "no table" } };
    await expect(
      claimInboxMessage({ automationId: "a1", workspaceId: "ws-1", inboxMessageId: "m1" }),
    ).rejects.toThrow(/claimInboxMessage failed/);
  });
});

describe("getAutomationByZapierWorkflowId", () => {
  it("resolves a Zapier workflow id back to its automation", async () => {
    nextResult = { data: { id: "a1", zapier_workflow_id: "wf_1" }, error: null };
    const row = await getAutomationByZapierWorkflowId("wf_1");
    expect(row?.id).toBe("a1");
  });
});
