"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GitBranch, Play, Sparkles, Check, ChevronRight } from "@/components/icons/hi";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";

type Phase = "chat" | "highlight" | "extracting" | "extracted" | "running" | "done";

type Scenario = {
  id: string;
  convoId: string;
  name: string;
  chat: Array<{ role: "user" | "agent"; text: string }>;
  steps: Array<{ app: string; action: string }>;
  runTime: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "standup",
    convoId: "#4,821",
    name: "Monday standup",
    chat: [
      { role: "user", text: "Every Monday, email the team standup link and create a Linear issue for blockers." },
      { role: "agent", text: "Got it. Sending the standup email now…" },
      { role: "agent", text: "Sent. And created LIN-4821 for blockers." },
    ],
    steps: [
      { app: "Gmail", action: "Send email · Team standup link" },
      { app: "Linear", action: "Create issue · Blockers" },
    ],
    runTime: "4.2s",
  },
  {
    id: "onboard",
    convoId: "#4,862",
    name: "New customer onboarding",
    chat: [
      { role: "user", text: "When a customer signs up in Stripe, add them to Notion CRM and send the welcome email." },
      { role: "agent", text: "Watching Stripe for new customers…" },
      { role: "agent", text: "Added Acme Corp to CRM. Welcome email sent." },
    ],
    steps: [
      { app: "Stripe", action: "Watch · New customer" },
      { app: "Notion", action: "Create page · CRM entry" },
      { app: "Gmail", action: "Send email · Welcome template" },
    ],
    runTime: "3.1s",
  },
  {
    id: "sprint-end",
    convoId: "#4,903",
    name: "Sprint cleanup",
    chat: [
      { role: "user", text: "End of sprint: close done Linear tickets, post a summary to #general, schedule the retro." },
      { role: "agent", text: "Closing 14 tickets marked Done…" },
      { role: "agent", text: "Posted summary to #general. Retro scheduled Friday 2pm." },
    ],
    steps: [
      { app: "Linear", action: "Close · 14 done tickets" },
      { app: "Slack", action: "Post · #general summary" },
      { app: "Google Calendar", action: "Schedule · Sprint retro" },
    ],
    runTime: "5.8s",
  },
  {
    id: "weekly-wins",
    convoId: "#4,947",
    name: "Friday wins report",
    chat: [
      { role: "user", text: "Every Friday afternoon, post this week's wins to Slack and export the metrics to Google Sheets." },
      { role: "agent", text: "Pulling this week's wins from Linear and GitHub…" },
      { role: "agent", text: "Posted to #wins. Metrics exported to the Q3 sheet." },
    ],
    steps: [
      { app: "Linear", action: "Query · Done this week" },
      { app: "GitHub", action: "Query · Merged PRs" },
      { app: "Slack", action: "Post · #wins summary" },
      { app: "Google Sheets", action: "Append rows · Metrics" },
    ],
    runTime: "7.4s",
  },
];

export function WorkflowExtraction() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("chat");
  const [runStep, setRunStep] = useState(-1);

  const scenario = SCENARIOS[scenarioIdx];

  useEffect(() => {
    if (!inView) return;

    const sequence: { phase: Phase; delay: number }[] = [
      { phase: "chat", delay: 2400 },
      { phase: "highlight", delay: 1400 },
      { phase: "extracting", delay: 1100 },
      { phase: "extracted", delay: 1400 },
      { phase: "running", delay: 2600 + scenario.steps.length * 200 },
      { phase: "done", delay: 1800 },
    ];

    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const runTimers: ReturnType<typeof setTimeout>[] = [];

    const advance = () => {
      const step = sequence[i];
      setPhase(step.phase);

      if (step.phase === "running") {
        setRunStep(-1);
        for (let s = 0; s < scenario.steps.length; s++) {
          runTimers.push(setTimeout(() => setRunStep(s), 300 + s * 800));
        }
        runTimers.push(setTimeout(() => setRunStep(scenario.steps.length), 300 + scenario.steps.length * 800));
      }
      if (step.phase === "chat") setRunStep(-1);

      timeout = setTimeout(() => {
        i++;
        if (i >= sequence.length) {
          // cycle to the next scenario after the full loop
          i = 0;
          setScenarioIdx((idx) => (idx + 1) % SCENARIOS.length);
        }
        advance();
      }, step.delay);
    };

    advance();
    return () => {
      clearTimeout(timeout);
      runTimers.forEach(clearTimeout);
    };
  }, [inView, scenarioIdx, scenario.steps.length]);

  const highlighted = phase === "highlight" || phase === "extracting";

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-4">
      {/* Chat column */}
      <TiltedSpotlight>
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <AnimatePresence mode="wait">
            <motion.span
              key={scenario.convoId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-mono text-muted truncate"
            >
              conversation {scenario.convoId}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence>
            {phase === "highlight" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-wider text-accent flex items-center gap-1 shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                pattern detected
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="p-4 space-y-3 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {scenario.chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <motion.div
                    animate={{
                      boxShadow: highlighted ? "0 0 0 2px var(--accent)" : "0 0 0 0px transparent",
                    }}
                    transition={{ duration: 0.3 }}
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-foreground text-background rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      </TiltedSpotlight>

      {/* Workflow column */}
      <TiltedSpotlight>
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-xs font-medium text-muted truncate">Workflow</span>
          </div>
          <AnimatePresence>
            {phase === "done" && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-wider text-accent shrink-0"
              >
                ran in {scenario.runTime}
              </motion.span>
            )}
          </AnimatePresence>
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
                key={`steps-${scenario.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold truncate pr-2">{scenario.name}</div>
                  {phase === "extracted" && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="button"
                      className="flex items-center gap-1 rounded-md bg-accent text-accent-foreground px-2.5 py-1 text-[11px] font-medium shrink-0"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </motion.button>
                  )}
                  {phase === "running" && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[11px] text-accent font-medium flex items-center gap-1 shrink-0"
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
                      className="text-[11px] text-accent font-medium flex items-center gap-1 shrink-0"
                    >
                      <Check className="h-3 w-3" /> done
                    </motion.span>
                  )}
                </div>
                {scenario.steps.map((step, i) => {
                  const running = phase === "running" && runStep === i;
                  const complete =
                    (phase === "running" && runStep > i) || phase === "done";
                  return (
                    <motion.div
                      key={`${scenario.id}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
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
                        className="h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-mono shrink-0"
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
                      <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </TiltedSpotlight>
    </div>
  );
}
