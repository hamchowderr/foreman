/**
 * Shared types for the automations data layer. Kept out of the "use server"
 * module (data/automations.ts) because a "use server" file may only export async
 * functions. Shapes mirror the agent /automations route responses.
 */

export interface ScheduleSpec {
  /** Cron expression; Mastra's WorkflowScheduler owns the firing (foreman-bhb5). */
  cron: string;
  timezone?: string;
}

export interface AutomationTriggerSpec {
  app?: string;
  action?: string;
  connection?: string | number | null;
  inputs?: Record<string, unknown>;
  /** A recurring schedule (foreman-ufo3.3) — present instead of app/action for scheduled automations. */
  schedule?: ScheduleSpec;
  /** With `schedule`, this automation is a daily digest of recent activity. */
  digest?: boolean;
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

/** A run surfaced in a digest bucket (failures / waiting / retrying). */
export interface DigestRunRef {
  automationId: string;
  automationName: string;
  createdAt: string;
  error?: string | null;
}

/** The workspace's latest daily digest (foreman-ufo3.2). */
export interface AutomationDigest {
  kind: "automation_digest";
  periodStart: string;
  periodEnd: string;
  totals: {
    total: number;
    finished: number;
    failed: number;
    waiting: number;
    retrying: number;
    other: number;
  };
  failures: DigestRunRef[];
  waiting: DigestRunRef[];
  retrying: DigestRunRef[];
  headline: string;
  /** Optional LLM prose summary; null when the narrative layer is off. */
  narrative?: string | null;
}

export interface WorkspaceInbox {
  entries: WorkspaceInboxEntry[];
  digest: AutomationDigest | null;
}

export interface RunResult {
  runId: string;
  triggerId: string;
  status: string;
  durableRunId: string | null;
}
