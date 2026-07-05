/**
 * LLM narrative layer for the daily digest (foreman-ufo3, opt-in). The digest
 * itself is deterministic (digest.ts); this OPTIONALLY wraps it with a short
 * prose summary from a small model. Off by default — enable with
 * FOREMAN_DIGEST_NARRATIVE=true — and it degrades to null on any failure so the
 * deterministic digest always ships regardless of the LLM.
 *
 * Model: FOREMAN_DIGEST_MODEL (a `provider/model` string, e.g.
 * openai/gpt-4o-mini) falling back to the fast tier. Resolution + provider keys
 * go through Mastra's gateway, same as the agents.
 */
import { Agent } from "@mastra/core/agent";
import { MODELS } from "../providers/models";
import {
  type AutomationDigest,
  buildDigestNarrativePrompt,
  DIGEST_NARRATOR_INSTRUCTIONS,
} from "./digest";

/** Is the LLM narrative layer switched on? Off unless explicitly enabled. */
export function isDigestNarrativeEnabled(): boolean {
  return process.env.FOREMAN_DIGEST_NARRATIVE === "true";
}

function digestModel(): string {
  const override = process.env.FOREMAN_DIGEST_MODEL?.trim();
  return override && override.length > 0 ? override : MODELS.fast;
}

/** One-shot LLM call producing the narrative text. Overridable in tests. */
export type NarrativeGenerator = (instructions: string, prompt: string) => Promise<string>;

const defaultGenerator: NarrativeGenerator = async (instructions, prompt) => {
  const agent = new Agent({
    id: "digest-narrator",
    name: "digest-narrator",
    instructions,
    model: digestModel(),
  });
  const result = await agent.generate(prompt);
  return result.text ?? "";
};

/**
 * Produce a prose summary of a digest, or null when disabled/failed. Never throws
 * — a narrator failure must not stop the digest from being recorded.
 */
export async function narrateDigest(
  digest: AutomationDigest,
  generate: NarrativeGenerator = defaultGenerator,
): Promise<string | null> {
  if (!isDigestNarrativeEnabled()) return null;
  try {
    const text = (
      await generate(DIGEST_NARRATOR_INSTRUCTIONS, buildDigestNarrativePrompt(digest))
    ).trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error("[digest-narrator] narrative generation failed:", err);
    return null;
  }
}
