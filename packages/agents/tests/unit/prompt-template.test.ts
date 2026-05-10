import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/prompt-template";

describe("buildSystemPrompt", () => {
  it("returns base prompt with no context", () => {
    const result = buildSystemPrompt();
    expect(result).toContain("You are Foreman");
    expect(result).toContain("Zapier");
    expect(result).not.toContain("Connected Apps");
    expect(result).not.toContain("Recent Actions");
    expect(result).not.toContain("User Preferences");
  });

  it("references MCP tool names, not old custom names", () => {
    const result = buildSystemPrompt();
    // New MCP tool names
    expect(result).toContain("list-connections");
    expect(result).toContain("list-actions");
    expect(result).toContain("get-input-fields-schema");
    expect(result).toContain("list-input-field-choices");
    expect(result).toContain("run-action");
    expect(result).toContain("list-apps");
    // ToolSearchProcessor meta-tools
    expect(result).toContain("search_tools");
    expect(result).toContain("load_tool");
    // Old custom tool names should NOT be present
    expect(result).not.toContain("discover_connections");
    expect(result).not.toContain("get_action_schema");
    expect(result).not.toContain("get_field_choices");
    expect(result).not.toContain("execute_action");
  });

  it("lists always-available custom tools", () => {
    const result = buildSystemPrompt();
    expect(result).toContain("connect_zapier");
    expect(result).toContain("search_history");
    expect(result).toContain("fork_conversation");
  });

  it("returns base prompt with empty context", () => {
    const result = buildSystemPrompt({});
    expect(result).toContain("You are Foreman");
    expect(result).not.toContain("<connected_apps>");
  });

  it("includes connected apps when provided", () => {
    const result = buildSystemPrompt({
      connectedApps: ["Gmail", "Slack", "Notion"],
    });
    expect(result).toContain("<connected_apps>");
    expect(result).toContain("Gmail, Slack, Notion");
    expect(result).toContain("Use these when possible");
  });

  it("does not include connected apps section when array is empty", () => {
    const result = buildSystemPrompt({ connectedApps: [] });
    expect(result).not.toContain("<connected_apps>");
  });

  it("includes recent actions when provided", () => {
    const result = buildSystemPrompt({
      recentActions: ["Sent email via Gmail", "Created task in Notion"],
    });
    expect(result).toContain("<recent_actions>");
    expect(result).toContain("- Sent email via Gmail");
    expect(result).toContain("- Created task in Notion");
  });

  it("does not include recent actions section when array is empty", () => {
    const result = buildSystemPrompt({ recentActions: [] });
    expect(result).not.toContain("<recent_actions>");
  });

  it("includes user preferences when provided", () => {
    const result = buildSystemPrompt({
      preferences: {
        timezone: "US/Eastern",
        language: "English",
      },
    });
    expect(result).toContain("<user_preferences>");
    expect(result).toContain("- timezone: US/Eastern");
    expect(result).toContain("- language: English");
  });

  it("does not include preferences section when object is empty", () => {
    const result = buildSystemPrompt({ preferences: {} });
    expect(result).not.toContain("<user_preferences>");
  });

  it("includes all sections when full context is provided", () => {
    const result = buildSystemPrompt({
      connectedApps: ["Gmail"],
      recentActions: ["Sent email"],
      preferences: { timezone: "UTC" },
    });
    expect(result).toContain("<connected_apps>");
    expect(result).toContain("<recent_actions>");
    expect(result).toContain("<user_preferences>");
  });
});
