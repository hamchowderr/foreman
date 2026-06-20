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
import { Input } from "@/components/ui/input";

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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="button" onClick={rename} disabled={pending} size="sm">
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setName(currentName);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={runNow} disabled={running}>
            {running ? "Running…" : "Run now"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this workflow?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {err ? (
        <Alert variant="destructive" className="px-3 py-2">
          <AlertDescription className="text-xs">{err}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
