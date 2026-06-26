import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock every module the processor reaches into. The barrel re-exports
// listUserConnections, but loadUserConnectionsMap and searchAppCatalog
// come from their own modules and need their own mocks — otherwise they
// hit real Supabase and time the test out at 5s.
vi.mock("@/lib/zapier", () => ({
  listUserConnections: vi.fn(),
}));
vi.mock("@/lib/zapier/aliases", () => ({
  loadUserConnectionsMap: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/catalog", () => ({
  searchAppCatalog: vi.fn().mockResolvedValue([]),
}));

import type { ProcessInputResultWithSystemMessages } from "@mastra/core/processors";
import { contextInjector } from "@/lib/processors/input";
import { listUserConnections } from "@/lib/zapier";

const mockedListUserConnections = vi.mocked(listUserConnections);

// The element type of what listUserConnections resolves to — a Zapier SDK
// connection row. The catalog of required fields (date, is_invite_only,
// is_private, shared_with_all, id, account_id) comes straight from the SDK
// schema; app_name is NOT a field (the processor reads app_key, falling back
// from the optional app_name it tolerates structurally).
type Connection = Awaited<ReturnType<typeof listUserConnections>>[number];

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    date: "2026-01-01T00:00:00Z",
    is_invite_only: false,
    is_private: false,
    shared_with_all: false,
    id: "conn-1",
    account_id: "acct-1",
    ...overrides,
  };
}

describe("contextInjector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct metadata", () => {
    expect(contextInjector.id).toBe("context-injector");
    expect(contextInjector.name).toBe("Context Injector");
  });

  it("returns messages unchanged when no userId in requestContext", async () => {
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map();

    const result = (await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any)) as ProcessInputResultWithSystemMessages;

    expect(result.messages).toEqual(messages);
    expect(result.systemMessages).toEqual(systemMessages);
    expect(mockedListUserConnections).not.toHaveBeenCalled();
  });

  it("returns messages unchanged when connections list is empty", async () => {
    mockedListUserConnections.mockResolvedValue([]);
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = (await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any)) as ProcessInputResultWithSystemMessages;

    expect(result.systemMessages).toEqual(systemMessages);
  });

  it("injects context system message when connections exist", async () => {
    mockedListUserConnections.mockResolvedValue([
      connection({ app_key: "Gmail" }),
      connection({ app_key: "Slack" }),
    ]);
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = (await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any)) as ProcessInputResultWithSystemMessages;

    expect(result.systemMessages).toHaveLength(2);
    const injected = result.systemMessages[1];
    expect(injected.role).toBe("system");
    expect(injected.content).toContain("2 connected app(s)");
    expect(injected.content).toContain("Gmail, Slack");
  });

  it("uses app_key as fallback when app_name is missing", async () => {
    mockedListUserConnections.mockResolvedValue([connection({ app_key: "custom_app" })]);
    const requestContext = new Map([["userId", "user-1"]]);

    const result = (await contextInjector.processInput!({
      messages: [],
      systemMessages: [],
      requestContext,
    } as any)) as ProcessInputResultWithSystemMessages;

    expect(result.systemMessages).toHaveLength(1);
    expect(result.systemMessages[0].content).toContain("custom_app");
  });

  it("gracefully handles listUserConnections failure", async () => {
    mockedListUserConnections.mockRejectedValue(new Error("network error"));
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = (await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any)) as ProcessInputResultWithSystemMessages;

    // Should return original messages, not throw
    expect(result.messages).toEqual(messages);
    expect(result.systemMessages).toEqual(systemMessages);
  });
});
