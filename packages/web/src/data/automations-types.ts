/**
 * Shared types for the automations data layer. Kept out of the "use server"
 * module (data/automations.ts) because a "use server" file may only export async
 * functions. Shapes mirror the agent /automations route responses.
 */

export interface AutomationTriggerSpec {
  app?: string;
  action?: string;
  connection?: string | number | null;
  inputs?: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  status: string;
  zapier_workflow_id: string;
  editor_url: string | null;
  trigger: AutomationTriggerSpec | null;
  trigger_inbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  status: string;
  inbox_message_id: string | null;
  trigger_id: string | null;
  durable_run_id: string | null;
  /** Durable result on a finished run (null until terminal). */
  output: unknown;
  /**
   * Failure detail on a failed/stuck run; while status is "retrying" it holds the
   * in-flight DurableRunDetail (last_error + retrying ops, foreman-jc12). Null otherwise.
   */
  error: unknown;
  created_at: string;
  updated_at: string;
}

export interface AutomationDetail {
  automation: Automation;
  runs: AutomationRun[];
}

export interface InboxMessageAttributes {
  lease_count: number;
  error_message: string | null;
  possible_duplicate_data: boolean;
}

export interface InboxMessage {
  id: string;
  created_at: string;
  status: string;
  message_attributes: InboxMessageAttributes;
}

export interface InboxState {
  inbox: {
    id: string;
    status: string;
    paused_reason: string | null;
    subscription: {
      connection_id: string | number | null;
      app_key: string;
      action_key: string;
      inputs: Record<string, unknown>;
    };
  } | null;
  messages: InboxMessage[];
}

export type InboxPriorityLevel = "high" | "medium" | "low";

/** Importance/urgency ranking for an inbox entry (foreman-6r9y). */
export interface InboxPriority {
  score: number;
  level: InboxPriorityLevel;
  reasons: string[];
}

/** One automation's inbox within the workspace-wide aggregate (`/automations/inbox`). */
export interface WorkspaceInboxEntry {
  automation: {
    id: string;
    name: string;
    enabled: boolean;
    status: string;
    trigger: AutomationTriggerSpec | null;
  };
  /** Which workspace member owns this automation (teammate aggregation). */
  owner: { userId: string; isSelf: boolean };
  inbox: InboxState["inbox"];
  messages: InboxMessage[];
  priority: InboxPriority;
}

export interface WorkspaceInbox {
  entries: WorkspaceInboxEntry[];
}

export interface RunResult {
  runId: string;
  triggerId: string;
  status: string;
  durableRunId: string | null;
}
