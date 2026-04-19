"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Shield, Eye, Lock, Gauge, Users, Ban, Check, ChevronDown } from "lucide-react";

type Guardrail = {
  id: string;
  title: string;
  body: string;
  icon: typeof Shield;
  demo: () => React.ReactNode;
};

const GUARDRAILS: Guardrail[] = [
  {
    id: "approval",
    title: "Every write needs approval",
    body: "Sending, creating, deleting — Foreman shows the draft and waits.",
    icon: Shield,
    demo: () => <ApprovalDemo />,
  },
  {
    id: "pii",
    title: "PII redaction, always on",
    body: "Emails, keys, phones, cards, SSNs — stripped from every output.",
    icon: Eye,
    demo: () => <PiiDemo />,
  },
  {
    id: "encryption",
    title: "Tokens encrypted at rest",
    body: "AES-256-GCM for Zapier OAuth. SHA-256 hashed API keys.",
    icon: Lock,
    demo: () => <EncryptionDemo />,
  },
  {
    id: "blocked",
    title: "Sensitive apps blocked",
    body: "Banking, HR, security apps require explicit opt-in.",
    icon: Ban,
    demo: () => <BlockedDemo />,
  },
  {
    id: "rate",
    title: "Rate-limited per user",
    body: "30/min, 200/hour. Bulk ops over 5 records get extra confirmation.",
    icon: Gauge,
    demo: () => <RateDemo />,
  },
  {
    id: "org",
    title: "Admin override for orgs",
    body: "Org admins set guardrail defaults for every member.",
    icon: Users,
    demo: () => <OrgDemo />,
  },
];

export function GuardrailCards() {
  const [activeId, setActiveId] = useState<string>(GUARDRAILS[0].id);
  const active = GUARDRAILS.find((g) => g.id === activeId)!;

  return (
    <>
      {/* Mobile / tablet (below lg): accordion. Tapping a card expands it to reveal its demo inline. */}
      <div className="lg:hidden space-y-2">
        {GUARDRAILS.map((g) => {
          const selected = g.id === activeId;
          return (
            <div
              key={g.id}
              className={`rounded-xl border overflow-hidden transition-colors ${
                selected
                  ? "border-accent/40 bg-accent/[0.03]"
                  : "border-border/60 bg-background"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveId(selected ? "" : g.id)}
                aria-expanded={selected}
                className="w-full text-left p-4 flex items-start gap-3 min-h-[44px]"
              >
                <div
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors ${
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "bg-foreground/5 text-foreground/70"
                  }`}
                >
                  <g.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{g.title}</h3>
                  <p className="text-xs text-muted leading-relaxed mt-0.5">{g.body}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted shrink-0 transition-transform duration-200 mt-1 ${
                    selected ? "rotate-180 text-accent" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.div
                    key="demo"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.25 },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 bg-background/50 p-4">
                      {g.demo()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Desktop (lg+): grid of cards + sticky side panel */}
      <div className="hidden lg:grid grid-cols-[1fr_1.1fr] gap-4 items-start">
        <div className="grid grid-cols-2 gap-2">
          {GUARDRAILS.map((g) => {
            const selected = g.id === activeId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveId(g.id)}
                className={`text-left rounded-xl border p-4 transition-all duration-200 ${
                  selected
                    ? "border-accent/40 bg-accent/5 shadow-sm"
                    : "border-border/60 bg-background hover:border-border"
                }`}
              >
                <div
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-lg mb-3 transition-colors ${
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "bg-foreground/5 text-foreground/70"
                  }`}
                >
                  <g.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{g.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{g.body}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden sticky top-20">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <active.icon className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium">{active.title}</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted">live</span>
          </div>
          <div className="p-5 min-h-[260px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="w-full"
              >
                {active.demo()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

function ApprovalDemo() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm bg-foreground text-background px-3 py-1.5 text-sm max-w-[80%]">
          Delete all archived tasks in Trello
        </div>
      </div>
      <div className="rounded-xl border border-accent/30 bg-background">
        <div className="px-3 py-2 border-b border-accent/10 flex items-center justify-between">
          <span className="text-[11px] font-semibold">Trello · Delete 14 cards</span>
          <span className="text-[9px] text-accent uppercase tracking-wider">awaiting approval</span>
        </div>
        <div className="p-3 text-xs space-y-0.5 font-mono">
          <div><span className="text-muted">board</span> Personal</div>
          <div><span className="text-muted">list</span> Archive</div>
          <div><span className="text-muted">cards</span> 14</div>
        </div>
        <div className="px-3 py-2 border-t border-accent/10 flex gap-2">
          <button type="button" className="flex-1 rounded bg-foreground text-background text-xs py-1.5 font-medium">
            Approve
          </button>
          <button type="button" className="flex-1 rounded border border-border text-xs py-1.5 text-muted">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function PiiDemo() {
  return (
    <div className="font-mono text-xs sm:text-sm space-y-2">
      <div className="text-muted">// raw output</div>
      <div className="rounded bg-red-500/5 border border-red-500/20 p-2.5 text-red-600 dark:text-red-400 break-all">
        Contact: jane@acme.com, token: sk_live_51HxK2f, SSN: 123-45-6789
      </div>
      <div className="flex items-center justify-center py-1">
        <motion.span
          animate={{ y: [0, 2, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-accent"
        >
          ↓
        </motion.span>
      </div>
      <div className="text-muted">// after processor</div>
      <div className="rounded bg-accent/5 border border-accent/20 p-2.5 text-foreground break-all">
        Contact: <span className="bg-accent/20 text-accent rounded px-1">[EMAIL]</span>, token:{" "}
        <span className="bg-accent/20 text-accent rounded px-1">[API_KEY]</span>, SSN:{" "}
        <span className="bg-accent/20 text-accent rounded px-1">[SSN]</span>
      </div>
    </div>
  );
}

function EncryptionDemo() {
  const plain = "zapier_access_token_abc123";
  const encrypted = "a1:f23b:c7de:9014:77f5:83a2:cd6e:15b4";
  return (
    <div className="font-mono text-xs space-y-2">
      <div>
        <div className="text-muted mb-1">// plaintext (never stored)</div>
        <div className="rounded border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-red-600 dark:text-red-400 break-all line-through opacity-70">
          {plain}
        </div>
      </div>
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center text-[10px] uppercase tracking-widest text-accent"
      >
        AES-256-GCM
      </motion.div>
      <div>
        <div className="text-muted mb-1">// at rest</div>
        <div className="rounded border border-accent/20 bg-accent/5 px-2.5 py-2 text-foreground break-all">
          {encrypted}
        </div>
      </div>
    </div>
  );
}

function BlockedDemo() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm bg-foreground text-background px-3 py-1.5 text-sm max-w-[80%]">
          Transfer $500 from Chase to Venmo
        </div>
      </div>
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Banking access is blocked
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          I can't run actions against Chase without an explicit admin opt-in. Enable it in
          Settings → Sensitive Apps to allow banking actions.
        </p>
      </div>
    </div>
  );
}

function RateDemo() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Actions this minute</span>
          <span className="text-xs font-mono tabular-nums text-muted">28 / 30</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "93%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-accent to-red-500"
          />
        </div>
        <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-accent" />
          Queueing further requests to protect your Zapier quota.
        </div>
      </div>
    </div>
  );
}

function OrgDemo() {
  return (
    <div className="space-y-2">
      {[
        { label: "Allow sensitive apps", value: "off", admin: true },
        { label: "Require approval for deletes", value: "on", admin: true },
        { label: "Per-user rate limit", value: "30/min", admin: false },
      ].map((row) => (
        <div key={row.label} className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm">{row.label}</span>
            {row.admin && (
              <span className="text-[10px] text-accent uppercase tracking-wider">admin-locked</span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono">
            {row.value === "on" && <Check className="h-3 w-3 text-accent" />}
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
