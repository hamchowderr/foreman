"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "@/components/icons/hi";

type RunStatus = "started" | "finished" | "failed";

const STATIC_RUNS: Array<{
  id: string;
  label: string;
  when: string;
  status: RunStatus;
  detail: string;
}> = [
  {
    id: "r2",
    label: "Stripe payment → Slack + Sheet",
    when: "2m ago",
    status: "finished",
    detail: '{ "posted": "#finance", "row": 1182 }',
  },
  {
    id: "r3",
    label: "Failed charge → dunning email",
    when: "11m ago",
    status: "failed",
    detail: 'Step "charge" exhausted all retries',
  },
];

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "finished") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
        <Check className="h-2.5 w-2.5" /> finished
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> started
    </span>
  );
}

export function AutomationsDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: false });
  const [live, setLive] = useState<RunStatus>("started");
  const [elapsed, setElapsed] = useState(0.4);

  // Loop the top run started -> finished so the "live" reconcile is visible,
  // mirroring the real /automations poll (foreman-j3um). Pauses off-screen.
  useEffect(() => {
    if (!inView) return;
    let t = 0; // ms into the cycle
    const id = setInterval(() => {
      t += 100;
      if (t <= 2600) {
        setLive("started");
        setElapsed(t / 1000);
      } else if (t < 5200) {
        setLive("finished");
      } else {
        t = 0;
        setElapsed(0);
      }
    }, 100);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold">New subscriber → CRM + welcome</span>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          active
        </span>
      </div>

      {/* Runs */}
      <div className="space-y-2 p-3">
        <AnimatePresence initial={false} mode="wait">
          {live === "started" && (
            <motion.p
              key="live-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
            >
              <span className="h-2.5 w-2.5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              Live — updating as runs complete…
            </motion.p>
          )}
        </AnimatePresence>

        {/* Live run row */}
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium">Form → HubSpot + welcome email</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {elapsed.toFixed(1)}s
              </span>
              <StatusBadge status={live} />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {live === "finished" && (
              <motion.pre
                key="out"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                className="mt-2 overflow-hidden rounded-md bg-muted px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground"
              >
                {'{ "contact": "created", "email": "sent" }'}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>

        {/* Static context rows */}
        {STATIC_RUNS.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/70 bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{r.when}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
            <p
              className={`mt-1 truncate font-mono text-[10px] ${
                r.status === "failed" ? "text-destructive/80" : "text-muted-foreground"
              }`}
            >
              {r.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
