/**
 * LLM-judge accuracy scorer for Foreman experiments.
 *
 * The trajectory scorer (foreman-trajectory.ts) measures tool-call sequences
 * but is blind to text quality. The 6 v2 prompt refinements (confirmation
 * template, narration discipline, clarification tone, empty-schema handling,
 * premature confirm, Title Case fields) all affect text output, not tool
 * sequences — so trajectory-only scoring can't validate them.
 *
 * This scorer asks Haiku 4.5 to judge whether the agent's text response
 * matches groundTruth.expected_behavior. Score 0.0–1.0:
 *   1.0 — agent did exactly what the description specifies
 *   0.5 — partial match (right shape, wrong details, or vice-versa)
 *   0.0 — agent did something else entirely
 *
 * Haiku is the judge for cost (full-80 run adds ~$0.50 vs Sonnet's ~$3).
 */

import { createScorer } from "@mastra/core/evals";

interface ExpectedBehavior {
  expected_tools?: string[];
  forbidden_tools?: string[];
  expected_behavior?: string;
}

interface GroundTruth {
  category_hint?: string;
  expected_behavior?: ExpectedBehavior | null;
}

// Modern Mastra agent output is MastraDBMessage[] where each message has
// `content.parts: MastraMessagePart[]`. Tool invocations are at
// content.parts[].type === "tool-invocation" with toolInvocation.toolName
// inside; text parts at content.parts[].type === "text" with .text.
function getMessageParts(message: unknown): Array<Record<string, unknown>> {
  if (!message || typeof message !== "object") return [];
  const m = message as { content?: { parts?: unknown[] }; parts?: unknown[] };
  if (Array.isArray(m.content?.parts)) return m.content.parts as Array<Record<string, unknown>>;
  if (Array.isArray(m.parts)) return m.parts as Array<Record<string, unknown>>;
  return [];
}

function extractAgentText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const message of output) {
      const role = (message as { role?: string }).role;
      if (role && role !== "assistant") continue;
      for (const part of getMessageParts(message)) {
        if (part?.type === "text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }
    return parts.join("\n");
  }
  if (output && typeof output === "object" && "text" in (output as Record<string, unknown>)) {
    const t = (output as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

function extractActualToolNames(output: unknown): string[] {
  if (!Array.isArray(output)) return [];
  const names: string[] = [];
  for (const message of output) {
    for (const part of getMessageParts(message)) {
      if (part?.type === "tool-invocation") {
        const inv = part.toolInvocation as { toolName?: string } | undefined;
        if (inv?.toolName) names.push(inv.toolName);
      }
    }
  }
  return names;
}

const JUDGE_INSTRUCTIONS = `You are a quality judge for the Foreman AI agent — an automation assistant
that executes actions across 10,000+ apps via Zapier.

You will be given:
  1. The user's request
  2. A description of the EXPECTED behavior the agent should have shown
  3. The agent's ACTUAL text response
  4. The actual tool-call sequence the agent made

Your job is to score how well the actual response matches the expected behavior on a 0.0–1.0 scale.

Scoring rubric:
  1.0 — Agent did exactly what the description specifies. Right tone, right
        structure, right tool usage at the right moments.
  0.7-0.9 — Agent did the right thing with minor flaws (e.g., correct flow
        but slightly verbose; correct refusal but harsh tone).
  0.4-0.6 — Partial match. Agent got the shape right but missed key details,
        or got details right but in the wrong shape.
  0.1-0.3 — Agent attempted the right category but executed poorly (e.g.,
        asked clarifying question but added unnecessary tool calls).
  0.0 — Agent did something materially different from what was expected.

Be strict but fair. Reward concision and clarity. Penalize verbose narration,
unnecessary tool calls, accusatory clarification questions, and missing the
structured confirmation template for write actions.

Reply with ONLY a single number between 0 and 1 (e.g. "0.8"), nothing else.`;

const JUDGE_MODEL = "anthropic/claude-haiku-4-5-20251001";

export const foremanLLMJudgeScorer = createScorer({
  id: "foreman-llm-judge" as const,
  name: "Foreman LLM Judge",
  description:
    "Haiku-4.5 judge that scores agent text response against groundTruth.expected_behavior description.",
  type: "agent" as const,
  judge: {
    model: JUDGE_MODEL,
    instructions: JUDGE_INSTRUCTIONS,
  },
})
  .generateScore({
    description: "Compare agent response to expected behavior using the judge.",
    // Duplicate judge on the prompt object too — the runner only invokes the
    // LLM when judge is present here. Top-level scorer.judge alone is not enough.
    judge: {
      model: JUDGE_MODEL,
      instructions: JUDGE_INSTRUCTIONS,
    },
    createPrompt: ({ run }) => {
      const userInput =
        typeof run.input === "string" ? run.input : JSON.stringify(run.input).slice(0, 500);
      const agentText = extractAgentText(run.output) || "(no text response)";
      const actualTools = extractActualToolNames(run.output);
      const gt = (run as unknown as { groundTruth?: GroundTruth }).groundTruth;
      const expected =
        gt?.expected_behavior?.expected_behavior ?? "(no expected_behavior provided)";

      return `<user_request>
${userInput}
</user_request>

<expected_behavior>
${expected}
</expected_behavior>

<actual_agent_response>
${agentText}
</actual_agent_response>

<actual_tool_calls>
${actualTools.length === 0 ? "(none)" : actualTools.join(" → ")}
</actual_tool_calls>

Score (0.0–1.0):`;
    },
  })
  .generateReason({
    description: "Explain the score in one or two sentences.",
    judge: {
      model: JUDGE_MODEL,
      instructions:
        "You explain quality judgments. Given an agent run and the score it received, write 1-2 sentences explaining what the agent did well or poorly. Be specific. No preamble.",
    },
    createPrompt: ({ run, score }) => {
      const userInput =
        typeof run.input === "string" ? run.input : JSON.stringify(run.input).slice(0, 200);
      const agentText = extractAgentText(run.output) || "(no text response)";
      const actualTools = extractActualToolNames(run.output);
      const gt = (run as unknown as { groundTruth?: GroundTruth }).groundTruth;
      const expected = gt?.expected_behavior?.expected_behavior ?? "(no expected_behavior)";

      return `User request: ${userInput}

Expected behavior: ${expected}

Actual agent response: ${agentText.slice(0, 800)}

Actual tool calls: ${actualTools.length === 0 ? "(none)" : actualTools.join(" → ")}

Score given: ${score}

In 1-2 sentences, explain why this score was assigned. Be specific about what the agent did well or poorly.`;
    },
  });
