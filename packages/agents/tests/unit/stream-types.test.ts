import { describe, expectTypeOf, it } from "vitest";
import type { AppChunk } from "@/lib/stream/types";

describe("AppChunk type", () => {
  it("accepts text-delta variant", () => {
    const chunk: AppChunk = { type: "text-delta", text: "hello" };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts tool-call variant", () => {
    const chunk: AppChunk = {
      type: "tool-call",
      toolName: "test",
      args: { key: "value" },
    };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts proposal-created variant", () => {
    const chunk: AppChunk = {
      type: "proposal-created",
      proposal: {
        id: "p1",
        app_key: "gmail",
        action_type: "write",
        action_key: "send_email",
        human_label: "Send an email",
        inputs: {},
        input_schema: {},
        connection_id: null,
        status: "pending",
      },
    };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts action-executed variant", () => {
    const chunk: AppChunk = {
      type: "action-executed",
      proposalId: "p1",
      summary: "Email sent",
      result: { success: true },
    };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts error variant", () => {
    const chunk: AppChunk = {
      type: "error",
      code: "ERR",
      message: "Something went wrong",
    };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts error variant with proposalId", () => {
    const chunk: AppChunk = {
      type: "error",
      code: "ERR",
      message: "Failed",
      proposalId: "p1",
    };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts title-updated variant", () => {
    const chunk: AppChunk = { type: "title-updated", title: "New Title" };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });

  it("accepts done variant", () => {
    const chunk: AppChunk = { type: "done", runId: "run-123" };
    expectTypeOf(chunk).toMatchTypeOf<AppChunk>();
  });
});
