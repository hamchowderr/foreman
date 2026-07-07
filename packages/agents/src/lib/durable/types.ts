/**
 * Shared types for the durable-automation layer (foreman-l7xq).
 *
 * An "automation" = a durable workflow (the execution substrate) plus an optional
 * Zapier app trigger. The agent usually authors the durable `source` directly per
 * the Zapier durable format; `buildDurableSource` (source.ts) is a convenience
 * generator for simple linear specs.
 */

export type ActionType =
  | "write"
  | "read"
  | "read_bulk"
  | "search"
  | "search_or_write"
  | "search_and_write"
  | "filter"
  | "run";

/** A single app-action step — emitted as one `ctx.step` running one `runAction`. */
export interface AutomationStep {
  /** Step id, kebab-case — becomes the `ctx.step` name and the editor node label. */
  id: string;
  appKey: string;
  actionType: ActionType;
  actionKey: string;
  /** Connection alias (snake_case); resolved from the connections map at deploy/run. */
  connection: string;
  /**
   * Static action inputs, emitted as a literal. Dynamic references (prior steps,
   * workflow input) require agent-authored raw source, not this generator.
   */
  inputs?: Record<string, unknown>;
}

/**
 * A Zapier app trigger to claim on publish. Omit for manual/webhook automations.
 * `selectedApi` MUST be the version-pinned implementation id (e.g.
 * "GoogleSheetsAPI@2.3.0") — a bare app key makes the claim fail SILENTLY.
 */
export interface AutomationTrigger {
  selectedApi: string;
  action: string;
  authenticationId?: string | null;
  /** Trigger params, each shaped to its field `value_type` (ARRAY vs STRING). */
  params?: Record<string, unknown>;
}

/** Structured spec for the linear-automation source generator. */
export interface AutomationSpec {
  name: string;
  description?: string;
  steps: AutomationStep[];
  /** Connection alias → connection id. */
  connections?: Record<string, string | number>;
  trigger?: AutomationTrigger;
}
