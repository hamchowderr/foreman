"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Ban, Check } from "@/components/icons/hi";

type Step =
  | { kind: "user"; text: string }
  | { kind: "thinking" }
  | { kind: "proposal" }
  | { kind: "outcome" };

type Field = { label: string; value: string };

type Scenario = {
  user: string;
  app: string;
  action: string;
  badge: string;
  /** Tailwind bg + text classes for the little app chip. */
  badgeClass: string;
  fields: Field[];
  /** Whether the human approves the proposed action or declines it. */
  outcome: "approved" | "declined";
  result: string;
};

/**
 * The hero plays through these one after another, so the demo shows the breadth
 * of what Foreman can drive across the 10,000+ Zapier connections — not a single
 * canned example. Each is one realistic, approval-gated action in a different app,
 * and one (the refund) is *declined* so the approval gate is visible both ways.
 */
const SCENARIOS: Scenario[] = [
  {
    user: "Post in #launch that the new build is live.",
    app: "Slack",
    action: "Send Channel Message",
    badge: "S",
    badgeClass: "bg-[#4a154b] text-white",
    fields: [
      { label: "Channel", value: "#launch" },
      { label: "Message", value: "🚀 v2.4 is live" },
    ],
    outcome: "approved",
    result: "Posted to Slack.",
  },
  {
    user: "Add Acme as a new deal worth $24k.",
    app: "HubSpot",
    action: "Create Deal",
    badge: "H",
    badgeClass: "bg-[#ff7a59] text-white",
    fields: [
      { label: "Deal", value: "Acme Corp" },
      { label: "Amount", value: "$24,000" },
      { label: "Stage", value: "Qualified" },
    ],
    outcome: "approved",
    result: "Deal created in HubSpot.",
  },
  {
    user: "Refund the duplicate charge on order 4821.",
    app: "Stripe",
    action: "Create Refund",
    badge: "S",
    badgeClass: "bg-[#635bff] text-white",
    fields: [
      { label: "Charge", value: "ch_3PQ8…" },
      { label: "Amount", value: "$149.00" },
      { label: "Reason", value: "duplicate" },
    ],
    outcome: "declined",
    result: "Declined — nothing ran.",
  },
  {
    user: "Book a 30-min intro with Sam on Thursday.",
    app: "Google Calendar",
    action: "Create Event",
    badge: "C",
    badgeClass: "bg-[#4285f4] text-white",
    fields: [
      { label: "Title", value: "Intro — Sam" },
      { label: "When", value: "Thu, 2:00 PM" },
      { label: "Length", value: "30 min" },
    ],
    outcome: "approved",
    result: "Event added to Calendar.",
  },
  {
    user: "Log these notes in the project tracker.",
    app: "Notion",
    action: "Create Page",
    badge: "N",
    badgeClass: "bg-foreground text-background",
    fields: [
      { label: "Database", value: "Projects" },
      { label: "Title", value: "Kickoff notes" },
      { label: "Status", value: "In progress" },
    ],
    outcome: "approved",
    result: "Page added to Notion.",
  },
];

const STEPS_PER_SCENARIO = 4;
const STEP_DELAYS = [1400, 1800, 3400, 3600];

export function HeroDemo() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 });
  const rotateY = useTransform(springX, [-1, 1], [3, -3]);
  const rotateX = useTransform(springY, [-1, 1], [-3, 3]);

  useEffect(() => {
    const id = setTimeout(() => {
      setStep((s) => {
        if (s + 1 >= STEPS_PER_SCENARIO) {
          setScenarioIndex((sc) => (sc + 1) % SCENARIOS.length);
          return 0;
        }
        return s + 1;
      });
    }, STEP_DELAYS[step] ?? 2000);
    return () => clearTimeout(id);
  }, [step]);

  function handleMouse(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(px * 2);
    mouseY.set(py * 2);
  }

  function resetMouse() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const scenario = SCENARIOS[scenarioIndex];
  const steps: Step[] = [
    { kind: "user", text: scenario.user },
    { kind: "thinking" },
    { kind: "proposal" },
    { kind: "outcome" },
  ];

  const visible = steps.slice(0, step + 1).filter((item, i, arr) => {
    if (item.kind !== "thinking") return true;
    const next = arr[i + 1];
    return !next || next.kind === "thinking";
  });

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={resetMouse}
      style={
        reduce
          ? {}
          : {
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              transformPerspective: 1400,
            }
      }
      className="relative rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 overflow-hidden"
    >
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-muted-foreground font-mono">foreman · slack</span>
      </div>
      <div className="p-4 sm:p-6 min-h-[340px] sm:min-h-[380px] text-sm">
        {/* Keyed by scenario so the previous conversation fully clears before the
            next one enters — otherwise the new message mounts below the exiting
            bubbles and snaps to the top. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={scenarioIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {visible.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                {item.kind === "user" && <UserBubble text={item.text} />}
                {item.kind === "thinking" && <ThinkingBubble />}
                {item.kind === "proposal" && <ProposalCard scenario={scenario} />}
                {item.kind === "outcome" && (
                  <OutcomeBubble
                    approved={scenario.outcome === "approved"}
                    text={scenario.result}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2">
        {text}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2">
      {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
      <img
        alt="Foreman"
        className="h-7 w-7 object-contain"
        height={28}
        src="/zapier.svg"
        width={28}
      />
      <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-2.5 flex items-center gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function ProposalCard({ scenario }: { scenario: Scenario }) {
  const declined = scenario.outcome === "declined";
  return (
    <motion.div
      animate={{ scale: [1, 1.015, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className="flex items-start gap-2"
    >
      {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
      <img
        alt="Foreman"
        className="h-7 w-7 shrink-0 object-contain"
        height={28}
        src="/zapier.svg"
        width={28}
      />
      <div className="flex-1 min-w-0 rounded-2xl rounded-bl-sm bg-background border border-accent/30 overflow-hidden shadow-sm shadow-accent/10">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold shrink-0 ${scenario.badgeClass}`}
            >
              {scenario.badge}
            </span>
            <span className="text-xs font-medium truncate">
              {scenario.app} · {scenario.action}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-accent font-medium shrink-0 ml-2">
            approval
          </span>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-xs">
          {scenario.fields.map((field) => (
            <Row key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
          <button
            type="button"
            className={
              declined
                ? "rounded-md border border-border px-3 py-1 text-xs text-muted-foreground"
                : "rounded-md bg-foreground text-background px-3 py-1 text-xs font-medium"
            }
          >
            Approve &amp; run
          </button>
          <button
            type="button"
            className={
              declined
                ? "rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400"
                : "rounded-md border border-border px-3 py-1 text-xs text-muted-foreground"
            }
          >
            Decline
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-12 sm:w-14 shrink-0">{label}</span>
      <span className="font-mono truncate">{value}</span>
    </div>
  );
}

function OutcomeBubble({ approved, text }: { approved: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
      <img
        alt="Foreman"
        className="h-7 w-7 object-contain"
        height={28}
        src="/zapier.svg"
        width={28}
      />
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={
          approved
            ? "rounded-2xl rounded-bl-sm bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-4 py-2 text-sm flex items-center gap-2"
            : "rounded-2xl rounded-bl-sm bg-muted/40 text-muted-foreground border border-border px-4 py-2 text-sm flex items-center gap-2"
        }
      >
        {approved ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        {text}
      </motion.div>
    </div>
  );
}
