"use client";

import { useState } from "react";
import { useAgentFetch, saveWorkflow } from "@/lib/api-client";

interface SaveWorkflowDialogProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
}

export function SaveWorkflowDialog({
  conversationId,
  open,
  onClose,
}: SaveWorkflowDialogProps) {
  const agentFetch = useAgentFetch();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    workflowId: string;
    steps: number;
    parameters: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveWorkflow(agentFetch, conversationId, name.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setName("");
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "var(--background, #fff)",
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          maxWidth: 480,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <>
            <h3 style={{ margin: "0 0 12px" }}>Workflow saved</h3>
            <p style={{ margin: "0 0 8px" }}>
              Saved with {result.steps} step{result.steps !== 1 ? "s" : ""}.
            </p>
            {result.parameters.length > 0 && (
              <p style={{ margin: "0 0 8px", fontSize: 14, opacity: 0.7 }}>
                Parameters: {result.parameters.join(", ")}
              </p>
            )}
            <button
              onClick={handleClose}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: "0 0 12px" }}>Save as workflow</h3>
            <p style={{ margin: "0 0 12px", fontSize: 14, opacity: 0.7 }}>
              Conversation: {conversationId.slice(0, 8)}...
            </p>
            <input
              type="text"
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              disabled={saving}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: 14,
                boxSizing: "border-box",
              }}
              autoFocus
            />
            {error && (
              <p style={{ color: "red", margin: "8px 0 0", fontSize: 14 }}>
                {error}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                onClick={handleClose}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving || !name.trim() ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
