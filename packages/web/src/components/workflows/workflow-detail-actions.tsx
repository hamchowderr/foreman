"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function WorkflowDetailActions({
  workflowId,
  currentName,
}: {
  workflowId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function rename() {
    if (name.trim() === currentName || name.trim().length === 0) {
      setEditing(false);
      return;
    }
    setErr(null);
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      setErr(`Rename failed: ${res.status}`);
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  async function runNow() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: {} }),
      });
      if (!res.ok) {
        setErr(`Run failed: ${res.status}`);
        return;
      }
      // Drain the SSE stream so the run completes; we just refresh after.
      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      startTransition(() => router.refresh());
    } finally {
      setRunning(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    setErr(null);
    const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
    if (!res.ok) {
      setErr(`Delete failed: ${res.status}`);
      return;
    }
    router.push("/workflows");
  }

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border px-3 py-1.5 text-sm"
            style={{ borderColor: "#FFD7B5" }}
            autoFocus
          />
          <button
            type="button"
            onClick={rename}
            disabled={pending}
            className="rounded px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#FF4F00" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(currentName);
              setEditing(false);
            }}
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ color: "#7A6A5C" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="rounded px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF4F00" }}
          >
            {running ? "Running…" : "Run now"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: "#FFD7B5", color: "#201515" }}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: "#FFD7B5", color: "#A61B1B" }}
          >
            Delete
          </button>
        </div>
      )}
      {err ? (
        <div className="text-xs" style={{ color: "#A61B1B" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
