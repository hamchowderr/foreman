"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/client";

function nameFromMetadata(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" ? value : "";
}

export function ProfileForm() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; message: string } | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        const current = nameFromMetadata(user?.user_metadata);
        setName(current);
        setSaved(current);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    const trimmed = name.trim();
    const { error } = await createClient().auth.updateUser({ data: { full_name: trimmed } });
    setSaving(false);
    if (error) {
      setStatus({ type: "err", message: error.message });
      return;
    }
    setSaved(trimmed);
    setStatus({ type: "ok", message: "Profile updated." });
  }

  const dirty = name.trim() !== saved.trim();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Your display name is used to greet you in chat.
        </p>
      </div>

      {status && (
        <Alert variant={status.type === "err" ? "destructive" : "default"}>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      ) : (
        <Field className="max-w-sm">
          <FieldLabel htmlFor="display-name">Display name</FieldLabel>
          <Input
            disabled={saving}
            id="display-name"
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            value={name}
          />
          <FieldDescription>We'll greet you by your first name.</FieldDescription>
        </Field>
      )}

      <Button disabled={loading || saving || !dirty} onClick={handleSave}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
