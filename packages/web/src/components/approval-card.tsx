"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentFetch, patchProposal, fetchFieldChoices } from "@/lib/api-client";

interface Proposal {
  id: string;
  app_key: string;
  action_type: string;
  action_key: string;
  human_label: string;
  inputs: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  connection_id: string | null;
  status: string;
}

interface ApprovalCardProps {
  proposal: Proposal;
  onApprove: (proposalId: string) => void;
  onDecline: (proposalId: string) => void;
  disabled?: boolean;
}

export function ApprovalCard({
  proposal,
  onApprove,
  onDecline,
  disabled,
}: ApprovalCardProps) {
  const agentFetch = useAgentFetch();
  const [inputs, setInputs] = useState<Record<string, unknown>>(
    proposal.inputs
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const schemaProps =
    (proposal.input_schema as any)?.properties ??
    (proposal.input_schema as Record<string, any>);

  const handleApprove = useCallback(async () => {
    if (editing) {
      setSaving(true);
      await patchProposal(agentFetch, proposal.id, inputs);
      setSaving(false);
    }
    onApprove(proposal.id);
  }, [agentFetch, editing, inputs, proposal.id, onApprove]);

  const handleDecline = useCallback(() => {
    onDecline(proposal.id);
  }, [proposal.id, onDecline]);

  const updateField = useCallback(
    (key: string, value: unknown) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
      if (!editing) setEditing(true);
    },
    [editing]
  );

  return (
    <div className="my-3 rounded-xl border border-[#e0e0e0] dark:border-[#333] bg-white dark:bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e0e0e0] dark:border-[#333]">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center text-xs font-bold uppercase">
          {proposal.app_key.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {proposal.human_label}
          </p>
          <p className="text-xs text-foreground/50">
            {proposal.app_key} &middot; {proposal.action_key}
          </p>
        </div>
      </div>

      {/* Input fields */}
      <div className="px-4 py-3 space-y-3">
        {Object.entries(schemaProps).map(([key, fieldSchema]) => (
          <SchemaField
            key={key}
            fieldKey={key}
            schema={fieldSchema as Record<string, unknown>}
            value={inputs[key]}
            onChange={(v) => updateField(key, v)}
            proposalId={proposal.id}
            agentFetch={agentFetch}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-[#e0e0e0] dark:border-[#333]">
        <button
          onClick={handleApprove}
          disabled={disabled || saving}
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {editing ? "Edit & Approve" : "Approve"}
        </button>
        <button
          onClick={handleDecline}
          disabled={disabled}
          className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

type AgentFetch = (path: string, init?: RequestInit) => Promise<Response>;

function SchemaField({
  fieldKey,
  schema,
  value,
  onChange,
  proposalId,
  agentFetch,
  disabled,
}: {
  fieldKey: string;
  schema: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  proposalId: string;
  agentFetch: AgentFetch;
  disabled?: boolean;
}) {
  const label =
    (schema.title as string) ?? (schema.label as string) ?? fieldKey;
  const type = schema.type as string;
  const description = schema.description as string | undefined;
  const hasDynamicChoices = !!(schema as any)["x-dynamic-choices"];
  const enumValues = schema.enum as string[] | undefined;

  if (hasDynamicChoices) {
    return (
      <DynamicDropdownField
        fieldKey={fieldKey}
        label={label}
        description={description}
        value={value as string}
        onChange={onChange}
        proposalId={proposalId}
        agentFetch={agentFetch}
        disabled={disabled}
      />
    );
  }

  if (enumValues) {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground/70 mb-1">
          {label}
        </label>
        {description && (
          <p className="text-xs text-foreground/40 mb-1">{description}</p>
        )}
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-[#ddd] dark:border-[#444] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Select...</option>
          {enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="rounded"
        />
        <label className="text-sm text-foreground/70">{label}</label>
      </div>
    );
  }

  if (type === "number" || type === "integer") {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground/70 mb-1">
          {label}
        </label>
        {description && (
          <p className="text-xs text-foreground/40 mb-1">{description}</p>
        )}
        <input
          type="number"
          value={value != null ? String(value) : ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : "")
          }
          disabled={disabled}
          className="w-full rounded-lg border border-[#ddd] dark:border-[#444] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>
    );
  }

  // Default: string — use textarea for long content, input otherwise
  const isLong = String(value ?? "").length > 100;
  return (
    <div>
      <label className="block text-xs font-medium text-foreground/70 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-xs text-foreground/40 mb-1">{description}</p>
      )}
      {isLong ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-lg border border-[#ddd] dark:border-[#444] bg-transparent px-3 py-2 text-sm disabled:opacity-50 resize-y"
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-[#ddd] dark:border-[#444] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        />
      )}
    </div>
  );
}

function DynamicDropdownField({
  fieldKey,
  label,
  description,
  value,
  onChange,
  proposalId,
  agentFetch,
  disabled,
}: {
  fieldKey: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  proposalId: string;
  agentFetch: AgentFetch;
  disabled?: boolean;
}) {
  const [choices, setChoices] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFieldChoices(agentFetch, proposalId, fieldKey)
      .then((data) => {
        if (!cancelled) {
          setChoices(data.choices);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proposalId, fieldKey]);

  return (
    <div>
      <label className="block text-xs font-medium text-foreground/70 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-xs text-foreground/40 mb-1">{description}</p>
      )}
      {loading ? (
        <div className="w-full rounded-lg border border-[#ddd] dark:border-[#444] px-3 py-2 text-sm text-foreground/40">
          Loading choices...
        </div>
      ) : (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-[#ddd] dark:border-[#444] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Select...</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
