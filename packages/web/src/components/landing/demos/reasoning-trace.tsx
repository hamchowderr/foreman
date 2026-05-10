"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Brain, Check, MessageSquare } from "@/components/icons/hi";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";

type TraceStep = {
  tool: string;
  args: string;
  result: string;
  elapsedMs: number;
};

type Scene = {
  prompt: string;
  aside: string;
  finalLabel: string;
  trace: TraceStep[];
};

const SCENES: Scene[] = [
  {
    prompt: "Email Jake the Q3 deck and cc Priya.",
    aside:
      "Foreman doesn't guess. It looks up each piece — who Jake is, which Gmail connection to use, where the deck lives — then drafts the write and waits.",
    finalLabel: "gmail · send-email · 4 fields · awaiting approval",
    trace: [
      { tool: "search-history", args: '"jake email"', result: "jake@acme.com", elapsedMs: 182 },
      { tool: "search-history", args: '"priya email"', result: "priya@acme.com", elapsedMs: 140 },
      { tool: "search-actions", args: '"email"', result: "gmail · send-email", elapsedMs: 96 },
      {
        tool: "list-input-fields",
        args: "send-email",
        result: "to · cc · subject · body · attachment",
        elapsedMs: 71,
      },
      {
        tool: "run-action",
        args: 'drive-find-file, "Q3 deck"',
        result: "Q3-Review.pdf",
        elapsedMs: 348,
      },
    ],
  },
  {
    prompt: "Create a Trello card for the bug Priya mentioned in Slack.",
    aside:
      "To pull the right context, Foreman grabs the recent Slack thread, finds the right Trello board and list, then builds the card.",
    finalLabel: "trello · create-card · 4 fields · awaiting approval",
    trace: [
      {
        tool: "search-history",
        args: '"priya bug slack"',
        result: 'slack #bugs · "form submit fails on Safari 17"',
        elapsedMs: 221,
      },
      {
        tool: "search-actions",
        args: '"trello card"',
        result: "trello · create-card",
        elapsedMs: 88,
      },
      {
        tool: "list-input-fields",
        args: "create-card",
        result: "board · list · name · description",
        elapsedMs: 60,
      },
      {
        tool: "list-input-field-choices",
        args: "board",
        result: "Personal · Engineering · Roadmap",
        elapsedMs: 134,
      },
      {
        tool: "list-input-field-choices",
        args: 'list (board="Engineering")',
        result: "Inbox · In Progress · Done",
        elapsedMs: 102,
      },
    ],
  },
  {
    prompt: "What did Stripe say about invoice #INV-2091?",
    aside:
      "Read-only path: Foreman finds the Stripe connection, runs a search, summarizes. No approval needed — nothing writes.",
    finalLabel: "response ready · no write — no approval needed",
    trace: [
      { tool: "list-connections", args: '"stripe"', result: "stripe (connected)", elapsedMs: 74 },
      { tool: "search-actions", args: '"invoice"', result: "stripe · find-invoice", elapsedMs: 91 },
      {
        tool: "run-action",
        args: 'find-invoice, "INV-2091"',
        result: "Acme Corp · $12,400 · paid",
        elapsedMs: 312,
      },
      {
        tool: "list-input-field-choices",
        args: "expand",
        result: "line_items (2), customer, charge",
        elapsedMs: 68,
      },
      {
        tool: "run-action",
        args: 'find-invoice, id="INV-2091", expand=["charge"]',
        result: "ch_3Nx…KZ · paid Mar 28",
        elapsedMs: 288,
      },
    ],
  },
];

const STEP_DELAY_MS = 680;
const FINAL_LINGER_MS = 3200;
const SCENE_GAP_MS = 900;

export function ReasoningTrace() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: false });
  const [sceneIdx, setSceneIdx] = useState(0);
  const [stepsShown, setStepsShown] = useState(0);
  const [proposalReady, setProposalReady] = useState(false);

  const scene = SCENES[sceneIdx];

  useEffect(() => {
    if (!inView) return;

    setStepsShown(0);
    setProposalReady(false);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= scene.trace.length; i++) {
      timers.push(setTimeout(() => setStepsShown(i), i * STEP_DELAY_MS));
    }

    const doneAt = scene.trace.length * STEP_DELAY_MS;
    timers.push(setTimeout(() => setProposalReady(true), doneAt + 300));
    timers.push(
      setTimeout(
        () => {
          setSceneIdx((i) => (i + 1) % SCENES.length);
        },
        doneAt + FINAL_LINGER_MS + SCENE_GAP_MS,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [inView, sceneIdx, scene.trace.length]);

  const visible = scene.trace.slice(0, stepsShown);
  const totalElapsed = visible.reduce((a, s) => a + s.elapsedMs, 0);

  return (
    <div ref={ref} className="grid md:grid-cols-[0.9fr_1.1fr] gap-5 md:gap-6 items-stretch">
      {/* Left: the prompt */}
      <TiltedSpotlight className="flex">
        <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col w-full">
          <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-mono text-muted">prompt</span>
            </div>
            <div className="flex items-center gap-1">
              {SCENES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 w-4 rounded-full transition-colors ${
                    i === sceneIdx ? "bg-accent" : "bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-6 min-h-[280px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`prompt-${sceneIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-end"
              >
                <div className="max-w-[95%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2.5 text-sm leading-relaxed">
                  {scene.prompt}
                </div>
              </motion.div>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.div
                key={`aside-${sceneIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="flex items-start gap-2"
              >
                <div className="h-7 w-7 shrink-0 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                  <Brain className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs text-muted leading-relaxed">{scene.aside}</div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </TiltedSpotlight>

      {/* Right: the trace */}
      <TiltedSpotlight className="flex">
        <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col w-full">
          <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-mono text-muted">reasoning trace</span>
            </div>
            <span className="text-[10px] font-mono text-muted tabular-nums">{totalElapsed}ms</span>
          </div>

          <div className="p-4 sm:p-5 flex-1 font-mono text-[11px] sm:text-xs space-y-2 min-h-[280px]">
            <AnimatePresence mode="popLayout">
              {visible.map((step, i) => (
                <motion.div
                  key={`${sceneIdx}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-[auto_1fr_auto] gap-2 items-start"
                >
                  <span className="text-accent whitespace-nowrap">{step.tool}</span>
                  <span className="text-muted break-all">
                    <span className="opacity-60">(</span>
                    {step.args}
                    <span className="opacity-60">)</span>
                    <span className="mx-1.5 opacity-50">→</span>
                    <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                      <Check className="h-3 w-3 inline-block" />
                      {step.result}
                    </span>
                  </span>
                  <span className="text-muted/70 tabular-nums whitespace-nowrap">
                    {step.elapsedMs}ms
                  </span>
                </motion.div>
              ))}

              {proposalReady && (
                <motion.div
                  key={`ready-${sceneIdx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2"
                >
                  <span className="h-5 w-5 rounded-md bg-accent/15 text-accent inline-flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted">{scene.finalLabel}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </TiltedSpotlight>
    </div>
  );
}
