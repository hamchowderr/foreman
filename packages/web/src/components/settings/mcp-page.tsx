"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/client";

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

interface Props {
  mcpUrl: string;
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

function CodeBlock({ code }: { code: string }) {
  return (
    <div
      className="relative rounded-lg p-4 font-mono text-xs overflow-x-auto"
      style={{ backgroundColor: "#1a1a1a", color: "#e5e5e5" }}
    >
      <pre>{code}</pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} />
      </div>
    </div>
  );
}

export function McpPage({ mcpUrl }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getToken() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }

  useEffect(() => {
    async function fetchKeys() {
      try {
        const token = await getToken();
        const res = await fetch(`${AGENT_URL}/api-keys`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setKeys(data.keys ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchKeys();
  }, []);

  async function createKey() {
    const name = newKeyName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${AGENT_URL}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError("Couldn't create the API key. Please try again.");
        return;
      }
      const data = await res.json();
      setRevealedKey({ id: data.id, key: data.key });
      setKeys((k) => [
        {
          id: data.id,
          name,
          scopes: data.scopes,
          last_used_at: null,
          created_at: new Date().toISOString(),
        },
        ...k,
      ]);
      setNewKeyName("");
    } catch {
      setError("Couldn't create the API key. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${AGENT_URL}/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Couldn't revoke the API key. Please try again.");
        return;
      }
      setKeys((k) => k.filter((key) => key.id !== id));
      if (revealedKey?.id === id) setRevealedKey(null);
    } catch {
      setError("Couldn't revoke the API key. Please try again.");
    } finally {
      setRevoking(null);
    }
  }

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        foreman: {
          url: mcpUrl,
          headers: { "X-API-Key": revealedKey?.key ?? "<your-api-key>" },
        },
      },
    },
    null,
    2,
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        foreman: {
          url: mcpUrl,
          headers: { "X-API-Key": revealedKey?.key ?? "<your-api-key>" },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: "#201515" }}>
          MCP & API Keys
        </h1>
        <p className="text-sm" style={{ color: "#888" }}>
          Connect any MCP-compatible client (Claude Desktop, Cursor, Windsurf) to your Foreman
          instance. Create an API key below, then paste the config into your client.
        </p>
      </div>

      {/* MCP Server URL */}
      <div>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "#201515" }}>
          Your MCP Server URL
        </h2>
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3"
          style={{ border: "1.5px solid #FFF3E6", backgroundColor: "#fff" }}
        >
          <span className="flex-1 font-mono text-sm truncate" style={{ color: "#201515" }}>
            {mcpUrl}
          </span>
          <CopyButton value={mcpUrl} />
        </div>
      </div>

      {/* API Keys */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "#201515" }}>
          API Keys
        </h2>

        {/* Create form */}
        <div className="flex items-end gap-2 mb-4">
          <Field className="flex-1">
            <FieldLabel htmlFor="new-key-name">Key name</FieldLabel>
            <Input
              id="new-key-name"
              type="text"
              placeholder="Key name (e.g. Claude Desktop)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
          </Field>
          <Button type="button" onClick={createKey} disabled={creating || !newKeyName.trim()}>
            {creating ? "Creating…" : "Create Key"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Revealed key banner */}
        {revealedKey && (
          <div
            className="rounded-lg p-4 mb-4 space-y-2"
            style={{ backgroundColor: "#fff7ed", border: "1.5px solid #FFBF6E" }}
          >
            <p className="text-xs font-medium" style={{ color: "#92400e" }}>
              Copy this key now — it will never be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm break-all" style={{ color: "#201515" }}>
                {revealedKey.key}
              </code>
              <CopyButton value={revealedKey.key} />
            </div>
          </div>
        )}

        {/* Key list */}
        <div className="space-y-2">
          {loading && (
            <>
              <Skeleton className="h-[60px] w-full rounded-lg" />
              <Skeleton className="h-[60px] w-full rounded-lg" />
              <Skeleton className="h-[60px] w-full rounded-lg" />
            </>
          )}
          {!loading && keys.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No API keys yet</EmptyTitle>
                <EmptyDescription>
                  Create a key above to connect an MCP client to Foreman.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ border: "1.5px solid #FFF3E6", backgroundColor: "#fff" }}
            >
              <div>
                <span className="text-sm font-medium" style={{ color: "#201515" }}>
                  {k.name}
                </span>
                <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at
                    ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                    : " · Never used"}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => revokeKey(k.id)}
                disabled={revoking === k.id}
              >
                {revoking === k.id ? "Revoking…" : "Revoke"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Config snippets */}
      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "#201515" }}>
          Claude Desktop config
        </h2>
        <p className="text-xs mb-3" style={{ color: "#888" }}>
          Add this to{" "}
          <code className="font-mono">
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
        </p>
        <CodeBlock code={claudeDesktopConfig} />
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "#201515" }}>
          Cursor / Windsurf config
        </h2>
        <p className="text-xs mb-3" style={{ color: "#888" }}>
          Add this to your <code className="font-mono">.cursor/mcp.json</code> or{" "}
          <code className="font-mono">.windsurfrules</code>
        </p>
        <CodeBlock code={cursorConfig} />
      </div>
    </div>
  );
}
