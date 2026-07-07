"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/client";

interface Props {
  channel: string;
  displayName: string;
  icon: React.ReactNode;
  iconColor?: string;
  description: string;
  botLink: string | null;
  botLinkLabel: string;
  steps: string[];
  linkCommand?: string;
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";
const POLL_INTERVAL_MS = 4000;
const CODE_TTL_MS = 15 * 60 * 1000;

async function getToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

function formatSecondsLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ChannelConnectPage({
  channel,
  displayName,
  icon,
  iconColor,
  description,
  botLink,
  botLinkLabel,
  steps,
  linkCommand = "/link",
}: Props) {
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const botConnected = searchParams?.get("connected") === "1";
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [msLeft, setMsLeft] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check if already linked
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      try {
        const res = await fetch(`${AGENT_URL}/channel-links/identities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const { identities } = await res.json();
        if ((identities ?? []).some((i: { channel: string }) => i.channel === channel)) {
          setLinked(true);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [channel]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    timerRef.current = setInterval(() => {
      const left = expiresAt - Date.now();
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current!);
        setCode(null);
        setExpiresAt(null);
        stopPolling();
      }
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [expiresAt]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      setChecking(true);
      try {
        const token = await getToken();
        const res = await fetch(`${AGENT_URL}/channel-links/identities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { identities } = await res.json();
        if ((identities ?? []).some((i: { channel: string }) => i.channel === channel)) {
          setLinked(true);
          setCode(null);
          stopPolling();
        }
      } finally {
        setChecking(false);
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => () => stopPolling(), []);

  async function generateCode() {
    setGenerating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${AGENT_URL}/channel-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCode(data.code);
      setExpiresAt(Date.now() + CODE_TTL_MS);
      setMsLeft(CODE_TTL_MS);
      startPolling();
    } finally {
      setGenerating(false);
    }
  }

  if (linked) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: iconColor ? `${iconColor}18` : "#f3f4f6" }}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "#201515" }}>
              {displayName}
            </h1>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#d1fae5", color: "#065f46" }}
            >
              Connected
            </span>
          </div>
        </div>
        <p className="text-sm" style={{ color: "#888" }}>
          Your {displayName} account is linked. Messages you send the Foreman bot will use your
          Foreman identity, history, and Zapier connections.
        </p>
        <Link
          href="/settings/integrations"
          className="inline-block text-sm font-medium"
          style={{ color: "#FF4F00" }}
        >
          ← Back to integrations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconColor ? `${iconColor}18` : "#f3f4f6" }}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#201515" }}>
            {displayName}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>
            {description}
          </p>
        </div>
      </div>

      {/* Bot connected banner */}
      {botConnected && (
        <Alert>
          <AlertDescription>
            ✓ {displayName} bot connected to your workspace. Now complete step 2 below to link your
            personal account.
          </AlertDescription>
        </Alert>
      )}

      {/* Bot link */}
      {botLink ? (
        <Button asChild>
          <a href={botLink} target="_blank" rel="noopener noreferrer">
            {botLinkLabel} ↗
          </a>
        </Button>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            {displayName} bot not configured. Set{" "}
            <code className="font-mono text-xs">
              NEXT_PUBLIC_{channel.toUpperCase()}_INSTALL_URL
            </code>{" "}
            to enable the install link.
          </AlertDescription>
        </Alert>
      )}

      {/* Steps */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "#201515" }}>
          How to connect
        </h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: numbered instruction list — order IS the identity
            <li key={i} className="flex gap-3">
              <span
                className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#FF4F00" }}
              >
                {i + 1}
              </span>
              <span className="text-sm pt-0.5" style={{ color: "#201515" }}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Code generator */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ border: "1.5px solid #FFF3E6", backgroundColor: "#fff" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "#201515" }}>
          Link Code
        </h2>

        {!code ? (
          <Button type="button" onClick={generateCode} disabled={generating}>
            {generating ? "Generating…" : "Generate Link Code"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-mono text-3xl font-bold tracking-widest"
                style={{ color: "#201515" }}
              >
                {code}
              </span>
              <CopyButton value={`${linkCommand} ${code}`} label="Copy command" />
            </div>
            <p className="text-xs" style={{ color: "#888" }}>
              Copy the command above, then open the Foreman bot in {displayName} and paste it.{" "}
              Expires in{" "}
              <span style={{ color: msLeft < 60000 ? "#dc2626" : "#201515" }}>
                {formatSecondsLeft(msLeft)}
              </span>
              .
            </p>
            {checking && (
              <p className="text-xs" style={{ color: "#aaa" }}>
                Waiting for confirmation…
              </p>
            )}
            <Button
              type="button"
              variant="link"
              size="xs"
              className="px-0 text-muted-foreground"
              onClick={() => {
                setCode(null);
                setExpiresAt(null);
                stopPolling();
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <Link
        href="/settings/integrations"
        className="inline-block text-sm font-medium"
        style={{ color: "#FF4F00" }}
      >
        ← Back to integrations
      </Link>
    </div>
  );
}
