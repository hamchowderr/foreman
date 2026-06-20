"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
      <Switch
        checked={enabled}
        onCheckedChange={toggle}
        disabled={busy || pending}
        aria-label={enabled ? "Enabled" : "Disabled"}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm" disabled={busy || pending}>
            Detach
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach this trigger?</AlertDialogTitle>
            <AlertDialogDescription>The workflow won't be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={detach}>
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {err ? (
        <Alert variant="destructive" className="w-auto px-3 py-1.5">
          <AlertDescription className="text-xs">{err}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
