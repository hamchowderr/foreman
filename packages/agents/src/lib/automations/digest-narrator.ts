/**
 * LLM narrative layer for the daily digest (foreman-bhb5). Wraps the deterministic
 * digest (digest.ts) with a short prose summary. The narrator is a first-class
 * registry agent — its model comes from `AGENT_MODELS.digest` (env override
 * `DIGEST_MODEL`, fast-tier default), exactly like the other agents. No bespoke
 * feature flag: narration is a step of the digest workflow. It still fails soft to
 * null so a narrator error never breaks the (already-recorded) digest.
 */
import { Agent } from "@mastra/core/agent";
import { AGENT_MODELS } from "../providers/models";
import {
  type AutomationDigest,
  buildDigestNarrativePrompt,
  DIGEST_NARRATOR_INSTRUCTIONS,
} from "./digest";

/** One-shot LLM call producing the narrative text. Overridable in tests. */
export type NarrativeGenerator = (instructions: string, prompt: string) => Promise<string>;

const defaultGenerator: NarrativeGenerator = async (instructions, prompt) => {
  const agent = new Agent({
    id: "digest-narrator",
    name: "digest-narrator",
    instructions,
    model: AGENT_MODELS.digest,
  });
  const result = await agent.generate(prompt);
  return result.text ?? "";
};

/**
 * Produce a prose summary of a digest, or null on failure. Never throws — a
 * narrator failure (no provider key, rate limit, empty output) must not stop the
 * digest from being recorded.
 */
export async function narrateDigest(
  digest: AutomationDigest,
  generate: NarrativeGenerator = defaultGenerator,
): Promise<string | null> {
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
