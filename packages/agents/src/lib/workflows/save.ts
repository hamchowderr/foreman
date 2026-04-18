import { getDb, schema } from "@/lib/db";
import { extractParams } from "./params";
import { eq, and, asc } from "drizzle-orm";

/** Heuristic: values that look like they should become parameters. */
const PARAMETERIZE_PATTERNS = [
  // Email addresses
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // UUIDs
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Phone numbers (basic)
  /^\+?\d[\d\s\-()]{6,}$/,
];

function shouldParameterize(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return PARAMETERIZE_PATTERNS.some((re) => re.test(value));
}

/** Convert a hardcoded value into a parameter name based on the field key. */
function toParamName(key: string): string {
  // snake_case or camelCase -> readable param name
  return key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Save a workflow from a conversation's executed proposals.
 */
export async function saveWorkflowFromConversation(
  conversationId: string,
  userId: string,
  name: string,
  orgId?: string
): Promise<{ workflowId: string; steps: number; parameters: string[] }> {
  const db = getDb();

  // Verify conversation ownership
  const convRows = await db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, conversationId),
        eq(schema.conversation.userId, userId)
      )
    )
    .limit(1);

  if (!convRows[0]) {
    throw new Error("Conversation not found");
  }

  // Load executed proposals in order
  const proposals = await db
    .select()
    .from(schema.actionProposal)
    .where(
      and(
        eq(schema.actionProposal.conversationId, conversationId),
        eq(schema.actionProposal.status, "executed")
      )
    )
    .orderBy(asc(schema.actionProposal.createdAt));

  if (proposals.length === 0) {
    throw new Error(
      "No executed actions found in this conversation to save as a workflow"
    );
  }

  const workflowId = crypto.randomUUID();
  const now = new Date();
  const allParams = new Set<string>();

  // Build steps from proposals, auto-parameterizing hardcoded values
  const stepValues: Array<{
    id: string;
    workflowId: string;
    order: number;
    proposalTemplate: string;
  }> = [];

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const inputs = JSON.parse(p.inputs) as Record<string, unknown>;

    // Auto-parameterize values that look like they should be dynamic
    const parameterized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (shouldParameterize(key, value)) {
        const paramName = toParamName(key);
        parameterized[key] = `{{${paramName}}}`;
        allParams.add(paramName);
      } else {
        parameterized[key] = value;
      }
    }

    const template = {
      appKey: p.appKey,
      actionType: p.actionType,
      actionKey: p.actionKey,
      humanLabel: p.humanLabel,
      inputs: parameterized,
      connectionId: p.connectionId,
    };

    // Collect any explicit {{param}} refs already in the inputs
    for (const name of extractParams(parameterized)) {
      allParams.add(name);
    }

    stepValues.push({
      id: crypto.randomUUID(),
      workflowId,
      order: i,
      proposalTemplate: JSON.stringify(template),
    });
  }

  const parameters = [...allParams];

  // Insert workflow
  await db.insert(schema.workflow).values({
    id: workflowId,
    userId,
    name,
    sourceConversationId: conversationId,
    parameters: JSON.stringify(parameters),
    createdAt: now,
    updatedAt: now,
  });

  // Insert steps
  for (const step of stepValues) {
    await db.insert(schema.workflowStep).values(step);
  }

  return { workflowId, steps: stepValues.length, parameters };
}
