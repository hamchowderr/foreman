/**
 * Helpers for tests that send real agent turns through AIMock.
 *
 * The default models go through the Vercel AI Gateway (`vercel/...`), which
 * AIMock can't mock — tests/aimock-setup.ts only redirects the direct
 * Anthropic and OpenAI base URLs. Call `useDirectAnthropicModels()` before
 * importing an agent so its model resolves to a direct `anthropic/...` id and
 * the request lands on AIMock instead of the gateway.
 */

const AGENT_MODEL_ENV = [
  "FOREMAN_MODEL",
  "DISCOVERY_MODEL",
  "EXECUTION_MODEL",
  "SUPERVISOR_MODEL",
  "HISTORY_MODEL",
  "FILES_MODEL",
  "AUTOMATIONS_MODEL",
  "TABLES_MODEL",
  "DIGEST_MODEL",
] as const;

export const AIMOCK_SONNET = "anthropic/claude-sonnet-4-6";
export const AIMOCK_HAIKU = "anthropic/claude-haiku-4-5";

/** Point every model tier at direct Anthropic ids with a dummy key. Must run before the agent module is imported. */
export function useDirectAnthropicModels() {
  for (const key of AGENT_MODEL_ENV) delete process.env[key];
  process.env.MODEL_DEFAULT = AIMOCK_SONNET;
  process.env.MODEL_FAST = AIMOCK_HAIKU;
  process.env.MODEL_HEAVY = AIMOCK_SONNET;
  // `sk-aimock-` marks the key as a dummy, so AIMock never forwards it upstream.
  process.env.ANTHROPIC_API_KEY = "sk-aimock-test";
}

function aimockRoot(): string {
  const base = process.env.ANTHROPIC_BASE_URL;
  if (!base)
    throw new Error("ANTHROPIC_BASE_URL is unset — is tests/aimock-setup.ts the globalSetup?");
  return base.replace(/\/v1\/?$/, "");
}

export interface AimockJournalEntry {
  path: string;
  body: {
    model?: string;
    messages?: Array<{ role: string; content: unknown }>;
    tools?: Array<{ function?: { name: string } }>;
  };
  response: { status: number; fixture?: { match?: Record<string, unknown> } | null };
}

/** Every request AIMock has seen whose last user message contains `userMessage`, oldest first. */
export async function journalFor(userMessage: string): Promise<AimockJournalEntry[]> {
  const res = await fetch(`${aimockRoot()}/__aimock/journal?path=/v1/messages&limit=500`);
  const entries = (await res.json()) as AimockJournalEntry[];
  return entries.filter((e) =>
    e.body.messages?.some(
      (m) => m.role === "user" && JSON.stringify(m.content).includes(userMessage),
    ),
  );
}
