import { describe, it, expect } from "vitest";
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

  it("returns base prompt with empty context", () => {
    const result = buildSystemPrompt({});
    expect(result).toContain("You are Foreman");
    expect(result).not.toContain("Connected Apps");
  });

  it("includes connected apps when provided", () => {
    const result = buildSystemPrompt({
      connectedApps: ["Gmail", "Slack", "Notion"],
    });
    expect(result).toContain("## Connected Apps");
    expect(result).toContain("Gmail, Slack, Notion");
    expect(result).toContain("Use these when possible");
  });

  it("does not include connected apps section when array is empty", () => {
    const result = buildSystemPrompt({ connectedApps: [] });
    expect(result).not.toContain("Connected Apps");
  });

  it("includes recent actions when provided", () => {
    const result = buildSystemPrompt({
      recentActions: ["Sent email via Gmail", "Created task in Notion"],
    });
    expect(result).toContain("## Recent Actions");
    expect(result).toContain("- Sent email via Gmail");
    expect(result).toContain("- Created task in Notion");
  });

  it("does not include recent actions section when array is empty", () => {
    const result = buildSystemPrompt({ recentActions: [] });
    expect(result).not.toContain("Recent Actions");
  });

  it("includes user preferences when provided", () => {
    const result = buildSystemPrompt({
      preferences: {
        timezone: "US/Eastern",
        language: "English",
      },
    });
    expect(result).toContain("## User Preferences");
    expect(result).toContain("- timezone: US/Eastern");
    expect(result).toContain("- language: English");
  });

  it("does not include preferences section when object is empty", () => {
    const result = buildSystemPrompt({ preferences: {} });
    expect(result).not.toContain("User Preferences");
  });

  it("includes all sections when full context is provided", () => {
    const result = buildSystemPrompt({
      connectedApps: ["Gmail"],
      recentActions: ["Sent email"],
      preferences: { timezone: "UTC" },
    });
    expect(result).toContain("## Connected Apps");
    expect(result).toContain("## Recent Actions");
    expect(result).toContain("## User Preferences");
  });
});
