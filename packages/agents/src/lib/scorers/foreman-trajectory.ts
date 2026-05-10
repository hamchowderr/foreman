/**
 * Custom trajectory scorer for Foreman experiments.
 *
 * Why custom: Mastra's built-in createTrajectoryAccuracyScorerCode reads
 * `message.content.toolInvocations` (legacy AI SDK shape). Mastra's modern
 * agent output uses `message.parts[].type === "tool-invocation"` with
 * `toolInvocation.toolName` inside. The built-in scorer therefore extracts
 * an empty trajectory and returns 0 for every Foreman item.
 *
 * What this does:
 *   - Reads tool calls from `run.output` (MastraDBMessage[]) via parts
 *   - Compares the actual tool sequence against `run.expectedTrajectory.steps`
 *     using relaxed ordering (expected order must appear as a subsequence)
 *   - Scores 1.0 when the expected sequence is a subsequence of the actual
 *   - Penalizes blacklisted tools (any appearance → score = 0)
 *   - Treats `expectedTrajectory.steps: []` as "no tools expected" — score 1
 *     iff the agent called nothing
 */

import { createScorer } from "@mastra/core/evals";

// Modern Mastra agent output is MastraDBMessage[] where each message has
// `content.parts: MastraMessagePart[]`. Tool invocations are nested in
// content.parts[].type === "tool-invocation" with toolInvocation.toolName.
// (Legacy bare `message.parts` and `output.toolCalls` shapes also handled
// for resilience.)
function extractActualToolNames(output: unknown): string[] {
  const names: string[] = [];

  if (Array.isArray(output)) {
    for (const message of output as Array<{
      content?: { parts?: unknown[]; toolInvocations?: Array<{ toolName?: string }> };
      parts?: unknown[];
    }>) {
      // Modern shape: content.parts[]
      const partsList = Array.isArray(message?.content?.parts)
        ? message.content.parts
        : Array.isArray(message?.parts)
          ? message.parts
          : null;
      if (partsList) {
        for (const part of partsList as Array<Record<string, unknown>>) {
          if (part?.type === "tool-invocation") {
            const inv = part.toolInvocation as { toolName?: string } | undefined;
            if (inv?.toolName) names.push(inv.toolName);
          }
        }
      }
      // Legacy fallback: content.toolInvocations
      const ti = message?.content?.toolInvocations;
      if (Array.isArray(ti)) {
        for (const inv of ti) {
          if (inv?.toolName) names.push(inv.toolName);
        }
      }
    }
  }

  // Fallback: agent.generate result shape with output.toolCalls[]
  if (
    names.length === 0 &&
    output &&
    typeof output === "object" &&
    "toolCalls" in (output as Record<string, unknown>)
  ) {
    const toolCalls = (
      output as { toolCalls?: Array<{ payload?: { toolName?: string }; toolName?: string }> }
    ).toolCalls;
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        const name = tc?.payload?.toolName ?? tc?.toolName;
        if (name) names.push(name);
      }
    }
  }

  return names;
}

function extractExpected(groundTruth: unknown): {
  expectedTools: string[];
  forbiddenTools: string[];
  description: string | null;
} {
  const gt = groundTruth as
    | {
        expected_behavior?: {
          expected_tools?: string[];
          forbidden_tools?: string[];
          expected_behavior?: string;
        };
      }
    | undefined;
  const eb = gt?.expected_behavior;
  return {
    expectedTools: eb?.expected_tools ?? [],
    forbiddenTools: eb?.forbidden_tools ?? [],
    description: eb?.expected_behavior ?? null,
  };
}

function isSubsequence(needle: string[], haystack: string[]): boolean {
  let i = 0;
  for (const h of haystack) {
    if (i < needle.length && h === needle[i]) i++;
  }
  return i === needle.length;
}

function blacklistViolated(actual: string[], blacklist: string[] | undefined): string | null {
  if (!blacklist?.length) return null;
  for (const item of actual) {
    if (blacklist.includes(item)) return item;
  }
  return null;
}

export const foremanTrajectoryScorer = createScorer({
  id: "foreman-trajectory-accuracy" as const,
  name: "Foreman Trajectory Accuracy",
  description:
    "Compares actual tool sequence (from MastraDBMessage parts) against expectedTrajectory.steps. Relaxed ordering: expected steps must appear as a subsequence of actual. Blacklisted tools yield score 0.",
  type: "agent" as const,
})
  .preprocess(({ run }) => {
    const actual = extractActualToolNames(run.output);
    const { expectedTools, forbiddenTools } = extractExpected(
      (run as unknown as { groundTruth?: unknown }).groundTruth,
    );
    const blacklisted = blacklistViolated(actual, forbiddenTools);
    return {
      actual,
      expected: expectedTools,
      blacklisted,
    };
  })
  .generateScore(({ results }) => {
    const { actual, expected, blacklisted } = results.preprocessStepResult as {
      actual: string[];
      expected: string[];
      blacklisted: string | null;
    };
    if (blacklisted) return 0;
    if (expected.length === 0) {
      return actual.length === 0 ? 1 : 0.5;
    }
    return isSubsequence(expected, actual) ? 1 : 0;
  })
  .generateReason(({ results, score }) => {
    const { actual, expected, blacklisted } = results.preprocessStepResult as {
      actual: string[];
      expected: string[];
      blacklisted: string | null;
    };
    if (blacklisted) {
      return `Blacklisted tool "${blacklisted}" appeared in trajectory.`;
    }
    if (expected.length === 0) {
      return actual.length === 0
        ? "No tools expected and none called."
        : `No tools expected but ${actual.length} were called: ${actual.join(", ")}.`;
    }
    if (score === 1) {
      return `Expected sequence [${expected.join(" → ")}] is a subsequence of actual [${actual.join(" → ")}].`;
    }
    return `Expected sequence [${expected.join(" → ")}] is NOT a subsequence of actual [${actual.join(" → ")}].`;
  });
