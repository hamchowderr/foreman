"use client";

import { ChatSwitcher } from "@/components/chat/chat-switcher";
import type { ModelOption } from "@/components/chat/composer";
import { FOREMAN_APPROVAL_VIEWS } from "@/components/chat/foreman-approval-views";

/**
 * The web chat: mastra-chat-kit's `ChatSwitcher` (conversations │ chat │ workbench) on
 * Foreman's AgentController (agents server: mastra/lib/agent-controller.ts).
 *
 * Workbench: Files and Terminal show the user's own per-tenant workspace; Schedules
 * shows only their schedules. Browser stays off until it is isolated per tenant, and
 * Memory is off because Foreman doesn't run observational memory.
 */

const MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "anthropic" },
];

const SUGGESTIONS = [
  {
    label: "My connected apps",
    prompt: "Which apps do I have connected, and what can you do in each?",
  },
  {
    label: "Find a Slack channel",
    prompt: "Find my Slack channels and tell me which ones were active this week.",
  },
  {
    label: "Plan an automation",
    prompt:
      "When a new row is added to my Google Sheet, post a summary to Slack. Plan how you'd do this.",
  },
  { label: "Search past actions", prompt: "What actions did you run for me recently?" },
];

export function ForemanChat() {
  return (
    <ChatSwitcher
      className="h-dvh"
      workbenchTabs={["files", "terminal", "schedules"]}
      models={MODELS}
      webSearch={false}
      greeting={{
        title: "What should Foreman do?",
        description: "Ask it to look things up or take actions in your connected apps.",
      }}
      suggestions={SUGGESTIONS}
      approvalViews={FOREMAN_APPROVAL_VIEWS}
    />
  );
}
