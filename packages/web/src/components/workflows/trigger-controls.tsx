"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WorkflowTrigger } from "@/lib/workflows-client";

export function TriggerControls({
  workflowId,
  trigger,
}: {
  workflowId: string;
  trigger: WorkflowTrigger;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setErr(null);
    const next = !enabled;
    const res = await fetch(`/api/workflows/${workflowId}/triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`Toggle failed: ${res.status}`);
      return;
    }
    setEnabled(next);
    startTransition(() => router.refresh());
  }

  async function detach() {
    if (!confirm("Detach this trigger? The workflow won't be deleted.")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/workflows/${workflowId}/triggers/${trigger.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`Detach failed: ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || pending}
        className="rounded border px-3 py-1 text-xs font-medium"
        style={{
          borderColor: "#FFD7B5",
          backgroundColor: enabled ? "#FF4F00" : "#FFF",
          color: enabled ? "#FFF" : "#201515",
        }}
        aria-pressed={enabled}
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
      <button
        type="button"
        onClick={detach}
        disabled={busy || pending}
        className="rounded border px-3 py-1 text-xs font-medium"
        style={{ borderColor: "#FFD7B5", color: "#A61B1B" }}
      >
        Detach
      </button>
      {err ? (
        <span className="text-xs" style={{ color: "#A61B1B" }}>
          {err}
        </span>
      ) : null}
    </div>
  );
}
