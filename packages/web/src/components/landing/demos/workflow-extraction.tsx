"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GitBranch, Play, Sparkles, Check, ChevronRight } from "@/components/icons/hi";

type Phase = "chat" | "highlight" | "extracting" | "extracted" | "running" | "done";

const CHAT = [
  { role: "user", text: "Every Monday, email the team standup link and create a Linear issue for blockers." },
  { role: "agent", text: "Got it. Sending the standup email now…" },
  { role: "agent", text: "Sent. And created LIN-4821 for blockers." },
];

const STEPS = [
  { app: "Gmail", action: "Send email · Team standup link" },
  { app: "Linear", action: "Create issue · Blockers" },
];

export function WorkflowExtraction() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState<Phase>("chat");
  const [runStep, setRunStep] = useState(-1);

  useEffect(() => {
    if (!inView) return;

    const sequence: { phase: Phase; delay: number }[] = [
      { phase: "chat", delay: 2200 },
      { phase: "highlight", delay: 1400 },
      { phase: "extracting", delay: 1200 },
      { phase: "extracted", delay: 1400 },
      { phase: "running", delay: 2400 },
      { phase: "done", delay: 1800 },
    ];

    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    let runTimers: ReturnType<typeof setTimeout>[] = [];

    const advance = () => {
      const step = sequence[i];
      setPhase(step.phase);

      if (step.phase === "running") {
        setRunStep(-1);
        runTimers.push(setTimeout(() => setRunStep(0), 300));
        runTimers.push(setTimeout(() => setRunStep(1), 1200));
        runTimers.push(setTimeout(() => setRunStep(2), 2100));
      }
      if (step.phase === "chat") setRunStep(-1);

      timeout = setTimeout(() => {
        i = (i + 1) % sequence.length;
        advance();
      }, step.delay);
    };

    advance();
    return () => {
      clearTimeout(timeout);
      runTimers.forEach(clearTimeout);
    };
  }, [inView]);

  const highlighted = phase === "highlight" || phase === "extracting";

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-4">
      {/* Chat column */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono text-muted">conversation #4,821</span>
          <AnimatePresence>
            {phase === "highlight" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-wider text-accent flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                pattern detected
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="p-4 space-y-3 min-h-[280px]">
          {CHAT.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <motion.div
                animate={{
                  boxShadow: highlighted
                    ? "0 0 0 2px var(--accent)"
                    : "0 0 0 0px transparent",
                }}
                transition={{ duration: 0.3 }}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-br-sm"
                    : "bg-background border border-border rounded-bl-sm"
                }`}
              >
                {msg.text}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow column */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-mono text-muted">workflow.yaml</span>
          </div>
          {phase === "done" && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] uppercase tracking-wider text-accent"
            >
              ran in 4.2s
            </motion.span>
          )}
        </div>
        <div className="p-4 min-h-[280px]">
          <AnimatePresence mode="wait">
            {phase === "chat" || phase === "highlight" ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[240px] flex items-center justify-center text-sm text-muted"
              >
                No workflow yet.
              </motion.div>
            ) : phase === "extracting" ? (
              <motion.div
                key="extracting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-sm text-muted"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-6 w-6 text-accent" />
                </motion.div>
                Extracting steps…
              </motion.div>
            ) : (
              <motion.div
                key="steps"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">Monday standup</div>
                  {phase === "extracted" && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="button"
                      className="flex items-center gap-1 rounded-md bg-accent text-accent-foreground px-2.5 py-1 text-[11px] font-medium"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </motion.button>
                  )}
                  {phase === "running" && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[11px] text-accent font-medium flex items-center gap-1"
                    >
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        running…
                      </motion.span>
                    </motion.span>
                  )}
                  {phase === "done" && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[11px] text-accent font-medium flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" /> done
                    </motion.span>
                  )}
                </div>
                {STEPS.map((step, i) => {
                  const running = phase === "running" && runStep === i;
                  const complete =
                    (phase === "running" && runStep > i) || phase === "done";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="rounded-lg bg-background border border-border p-3 flex items-center gap-3"
                    >
                      <motion.div
                        animate={{
                          backgroundColor: complete
                            ? "var(--accent)"
                            : running
                              ? "var(--accent)"
                              : "transparent",
                          borderColor: complete || running ? "var(--accent)" : "var(--border)",
                        }}
                        className="h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-mono"
                      >
                        {complete ? (
                          <Check className="h-3 w-3 text-white" />
                        ) : running ? (
                          <motion.div
                            className="h-2 w-2 rounded-full bg-white"
                            animate={{ scale: [1, 0.6, 1] }}
                            transition={{ duration: 0.9, repeat: Infinity }}
                          />
                        ) : (
                          <span className="text-muted">{i + 1}</span>
                        )}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{step.app}</div>
                        <div className="text-xs text-muted truncate">{step.action}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted" />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
