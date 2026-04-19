"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";

type ZapStep =
  | { id: "pick-trigger"; label: "Pick a trigger" }
  | { id: "config"; label: "Configure trigger" }
  | { id: "fields"; label: "Map 14 fields" }
  | { id: "filter"; label: "Add a filter" }
  | { id: "test"; label: "Test run" }
  | { id: "schema-err"; label: "Fix schema mismatch" }
  | { id: "deploy"; label: "Deploy Zap" };

const ZAP_STEPS: ZapStep[] = [
  { id: "pick-trigger", label: "Pick a trigger" },
  { id: "config", label: "Configure trigger" },
  { id: "fields", label: "Map 14 fields" },
  { id: "filter", label: "Add a filter" },
  { id: "test", label: "Test run" },
  { id: "schema-err", label: "Fix schema mismatch" },
  { id: "deploy", label: "Deploy Zap" },
];

const STEP_DURATION_MS = 900;
const TOTAL_ZAP_TIME = ZAP_STEPS.length * STEP_DURATION_MS;
const FOREMAN_TIME = 1600;

type Phase = "idle" | "running" | "zap-done" | "foreman-done" | "complete";

export function ZapVsForemanRace() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: false });
  const [zapStep, setZapStep] = useState(-1);
  const [foremanStep, setForemanStep] = useState<0 | 1 | 2 | 3>(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [zapElapsed, setZapElapsed] = useState(0);
  const [foremanElapsed, setForemanElapsed] = useState(0);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!inView) return;

    setPhase("running");
    setZapStep(0);
    setForemanStep(0);
    setZapElapsed(0);
    setForemanElapsed(0);

    const startTime = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;

      setZapElapsed(Math.min(elapsed, TOTAL_ZAP_TIME));
      setForemanElapsed(Math.min(elapsed, FOREMAN_TIME));

      const newZapStep = Math.min(Math.floor(elapsed / STEP_DURATION_MS), ZAP_STEPS.length - 1);
      setZapStep(newZapStep);

      if (elapsed < 500) setForemanStep(0);
      else if (elapsed < 1000) setForemanStep(1);
      else if (elapsed < 1500) setForemanStep(2);
      else setForemanStep(3);

      if (elapsed < TOTAL_ZAP_TIME) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase("complete");
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, runKey]);

  const restart = () => setRunKey((k) => k + 1);

  const zapProgress = Math.min((zapElapsed / TOTAL_ZAP_TIME) * 100, 100);
  const foremanProgress = Math.min((foremanElapsed / FOREMAN_TIME) * 100, 100);

  return (
    <div ref={ref} className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {/* Left: Building a Zap */}
        <div className="relative rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted/60" />
              <span className="text-xs font-semibold">Building a Zap</span>
            </div>
            <span className="text-[10px] font-mono text-muted tabular-nums">
              {(zapElapsed / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="p-4 sm:p-5 space-y-2 min-h-[280px]">
            {ZAP_STEPS.map((step, i) => {
              const state =
                i < zapStep ? "done" : i === zapStep ? "active" : "pending";
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 text-sm transition-colors ${
                    state === "pending" ? "text-muted/40" : "text-foreground"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full border shrink-0 flex items-center justify-center text-[10px] font-mono transition-all ${
                      state === "done"
                        ? "bg-muted/20 border-muted/40 text-muted"
                        : state === "active"
                          ? "border-foreground bg-background"
                          : "border-border"
                    }`}
                  >
                    {state === "done" ? (
                      <Check className="h-3 w-3" />
                    ) : state === "active" ? (
                      <motion.div
                        className="h-2 w-2 rounded-full bg-foreground"
                        animate={{ scale: [1, 0.6, 1] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                      />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span className={step.id === "schema-err" && state !== "pending" ? "text-red-500 dark:text-red-400" : ""}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-border/50 relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-muted"
              animate={{ width: `${zapProgress}%` }}
              transition={{ ease: "linear", duration: 0.05 }}
            />
          </div>
        </div>

        {/* Right: Foreman */}
        <div className="relative rounded-xl border-2 border-accent/30 bg-accent/5 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-accent/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-xs font-semibold">Foreman</span>
            </div>
            <span className="text-[10px] font-mono text-accent tabular-nums">
              {(Math.min(foremanElapsed, FOREMAN_TIME) / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="p-4 sm:p-5 min-h-[280px] flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {foremanStep === 0 && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center text-xs text-muted"
                >
                  waiting for input…
                </motion.div>
              )}
              {foremanStep >= 1 && (
                <motion.div
                  key="msg"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2 text-sm">
                    Email Jake the Q3 deck.
                  </div>
                </motion.div>
              )}
              {foremanStep >= 2 && (
                <motion.div
                  key="draft"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl bg-background border border-accent/20 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-accent/10 flex items-center justify-between">
                    <span className="text-[11px] font-medium">Gmail · Send</span>
                    <span className="text-[9px] uppercase tracking-wider text-muted">draft</span>
                  </div>
                  <div className="px-3 py-2 text-xs space-y-0.5 font-mono">
                    <div><span className="text-muted">to</span> jake@acme.com</div>
                    <div><span className="text-muted">re</span> Q3 deck</div>
                  </div>
                </motion.div>
              )}
              {foremanStep >= 3 && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-auto flex items-center gap-2 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-3 py-2 text-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>Sent via Gmail</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="h-1 bg-accent/10 relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-accent"
              animate={{ width: `${foremanProgress}%` }}
              transition={{ ease: "linear", duration: 0.05 }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {phase === "complete" ? (
            <span className="text-accent font-medium">
              Foreman finished {((TOTAL_ZAP_TIME - FOREMAN_TIME) / 1000).toFixed(1)}s sooner.
            </span>
          ) : phase === "running" ? (
            "Running side-by-side…"
          ) : (
            "Watch them race."
          )}
        </span>
        {phase === "complete" && (
          <button
            type="button"
            onClick={restart}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Replay
          </button>
        )}
      </div>
    </div>
  );
}
