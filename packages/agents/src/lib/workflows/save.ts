import { getSupabase } from "@/lib/db";
import { extractParams } from "./params";
import { normalizeAppKey } from "@/lib/zapier/normalize";

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
  const supabase = getSupabase();

  // Verify conversation ownership
  const { data: conv } = await supabase
    .from("conversation")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!conv) {
    throw new Error("Conversation not found");
  }

  // Load executed proposals in order
  const { data: proposals } = await supabase
    .from("action_proposal")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "executed")
    .order("created_at", { ascending: true });

  if (!proposals || proposals.length === 0) {
    throw new Error(
      "No executed actions found in this conversation to save as a workflow"
    );
  }

  const workflowId = crypto.randomUUID();
  const now = new Date().toISOString();
  const allParams = new Set<string>();

  const stepValues: Array<{
    id: string;
    workflow_id: string;
    order: number;
    proposal_template: string;
  }> = [];

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const inputs = JSON.parse(p.inputs) as Record<string, unknown>;

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
      appKey: normalizeAppKey(p.app_key),
      actionType: p.action_type,
      actionKey: p.action_key,
      humanLabel: p.human_label,
      inputs: parameterized,
      connectionId: p.connection_id,
    };

    for (const name of extractParams(parameterized)) {
      allParams.add(name);
    }

    stepValues.push({
      id: crypto.randomUUID(),
      workflow_id: workflowId,
      order: i,
      proposal_template: JSON.stringify(template),
    });
  }

  const parameters = [...allParams];

  // Insert workflow
  await supabase.from("workflow").insert({
    id: workflowId,
    user_id: userId,
    name,
    source_conversation_id: conversationId,
    parameters: JSON.stringify(parameters),
    created_at: now,
    updated_at: now,
  });

  // Insert steps
  for (const step of stepValues) {
    await supabase.from("workflow_step").insert(step);
  }

  return { workflowId, steps: stepValues.length, parameters };
}
