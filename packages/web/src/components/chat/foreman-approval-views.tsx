"use client";

import { ToolScopeNotice } from "@/components/ai-elements/tool";
import { type ApprovalViews, ArgFields } from "@/components/chat/approval-view";
import { useBulkThreshold } from "@/hooks/use-bulk-threshold";
import { describeActionScope } from "@/lib/action-scope";
import type { PendingApproval } from "@/lib/agent-controller/events";

/**
 * Foreman's approval cards for the chat kit (`approvalViews`, components/chat/approval-view.tsx).
 *
 * Every Zapier write/destructive tool (the agent server's APPROVAL_REQUIRED set) gets a
 * plain title and, when the action touches more than one thing, the same size sentence the
 * old chat showed above the request (`ToolScopeNotice`, foreman-nz8b). Over the
 * workspace's `max_bulk_items` it turns amber. The arguments follow as labelled fields.
 */

/** Approval body: the size sentence (if any), then the arguments. */
function ZapierApprovalBody({ approval }: { approval: PendingApproval }) {
  const bulkThreshold = useBulkThreshold();
  const scope = describeActionScope(approval.toolName, approval.args);
  // A null count means the whole target (e.g. dropping a table): always oversized.
  const oversized = !!scope && (scope.count === null || scope.count > bulkThreshold);
  return (
    <>
      {scope && <ToolScopeNotice oversized={oversized} scope={scope} />}
      <ArgFields value={approval.args} />
    </>
  );
}

/** Tool id (kebab-case, as the agent server generates it) → card title. */
const ZAPIER_APPROVAL_TITLES: Record<string, string> = {
  "run-action": "Run this action in your app?",
  "create-action-run": "Start this action in your app?",
  fetch: "Send this request through your connection?",
  "create-table": "Create a Zapier table?",
  "delete-table": "Delete this table?",
  "create-table-records": "Add records to the table?",
  "update-table-records": "Update records in the table?",
  "delete-table-records": "Delete records from the table?",
  "create-table-fields": "Add fields to the table?",
  "delete-table-fields": "Delete fields from the table?",
};

export const FOREMAN_APPROVAL_VIEWS: ApprovalViews = Object.fromEntries(
  Object.entries(ZAPIER_APPROVAL_TITLES).map(([toolName, title]) => [
    toolName,
    (approval: PendingApproval) => ({
      title,
      body: <ZapierApprovalBody approval={approval} />,
    }),
  ]),
);
