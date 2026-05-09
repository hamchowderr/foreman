import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { contextInjector } from "@/lib/processors/input";
import { listUserConnections } from "@/lib/zapier";

const mockedListUserConnections = vi.mocked(listUserConnections);

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

    const result = await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any);

    expect(result.messages).toEqual(messages);
    expect(result.systemMessages).toEqual(systemMessages);
    expect(mockedListUserConnections).not.toHaveBeenCalled();
  });

  it("returns messages unchanged when connections list is empty", async () => {
    mockedListUserConnections.mockResolvedValue([]);
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any);

    expect(result.systemMessages).toEqual(systemMessages);
  });

  it("injects context system message when connections exist", async () => {
    mockedListUserConnections.mockResolvedValue([
      { app_name: "Gmail", app_key: "gmail" },
      { app_name: "Slack", app_key: "slack" },
    ]);
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any);

    expect(result.systemMessages).toHaveLength(2);
    const injected = result.systemMessages[1];
    expect(injected.role).toBe("system");
    expect(injected.content).toContain("2 connected app(s)");
    expect(injected.content).toContain("Gmail, Slack");
  });

  it("uses app_key as fallback when app_name is missing", async () => {
    mockedListUserConnections.mockResolvedValue([
      { app_key: "custom_app" },
    ]);
    const requestContext = new Map([["userId", "user-1"]]);

    const result = await contextInjector.processInput!({
      messages: [],
      systemMessages: [],
      requestContext,
    } as any);

    expect(result.systemMessages).toHaveLength(1);
    expect(result.systemMessages[0].content).toContain("custom_app");
  });

  it("gracefully handles listUserConnections failure", async () => {
    mockedListUserConnections.mockRejectedValue(new Error("network error"));
    const messages = [{ role: "user" as const, content: "hello" }];
    const systemMessages = [{ role: "system" as const, content: "base" }];
    const requestContext = new Map([["userId", "user-1"]]);

    const result = await contextInjector.processInput!({
      messages,
      systemMessages,
      requestContext,
    } as any);

    // Should return original messages, not throw
    expect(result.messages).toEqual(messages);
    expect(result.systemMessages).toEqual(systemMessages);
  });
});
