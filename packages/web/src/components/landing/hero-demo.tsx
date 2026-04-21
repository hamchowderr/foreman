"use client";

import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check } from "@/components/icons/hi";

type Step =
  | { kind: "user"; text: string }
  | { kind: "thinking" }
  | { kind: "proposal" }
  | { kind: "sent" };

const SCRIPT: Step[] = [
  { kind: "user", text: "Email Jake the Q3 deck and cc Priya." },
  { kind: "thinking" },
  { kind: "proposal" },
  { kind: "sent" },
];

const STEP_DELAYS = [1400, 1800, 3400, 3500];

export function HeroDemo() {
  const [index, setIndex] = useState(0);
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
    const id = setTimeout(
      () => setIndex((i) => (i + 1) % SCRIPT.length),
      STEP_DELAYS[index] ?? 2000,
    );
    return () => clearTimeout(id);
  }, [index]);

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

  const visible = SCRIPT.slice(0, index + 1);

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
        <span className="ml-3 text-xs text-muted font-mono">foreman · slack</span>
      </div>
      <div className="p-4 sm:p-6 space-y-3 min-h-[340px] sm:min-h-[380px] text-sm">
        <AnimatePresence>
          {visible.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {step.kind === "user" && <UserBubble text={step.text} />}
              {step.kind === "thinking" && <ThinkingBubble />}
              {step.kind === "proposal" && <ProposalCard />}
              {step.kind === "sent" && <SentBubble />}
            </motion.div>
          ))}
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
      <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
        F
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-2.5 flex items-center gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function ProposalCard() {
  return (
    <motion.div
      animate={{ scale: [1, 1.015, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className="flex items-start gap-2"
    >
      <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">
        F
      </div>
      <div className="flex-1 min-w-0 rounded-2xl rounded-bl-sm bg-background border border-accent/30 overflow-hidden shadow-sm shadow-accent/10">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white text-[10px] font-bold shrink-0">
              G
            </span>
            <span className="text-xs font-medium truncate">Gmail · Send Email</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-accent font-medium shrink-0 ml-2">
            approval
          </span>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-xs">
          <Row label="To" value="jake@acme.com" />
          <Row label="Cc" value="priya@acme.com" />
          <Row label="Subject" value="Q3 deck" />
          <Row label="Attach" value="Q3-Review.pdf" />
        </div>
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-foreground text-background px-3 py-1 text-xs font-medium"
          >
            Approve & send
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs text-muted"
          >
            Edit
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted w-12 sm:w-14 shrink-0">{label}</span>
      <span className="font-mono truncate">{value}</span>
    </div>
  );
}

function SentBubble() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
        F
      </div>
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="rounded-2xl rounded-bl-sm bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-4 py-2 text-sm flex items-center gap-2"
      >
        <Check className="h-4 w-4" />
        Sent via Gmail.
      </motion.div>
    </div>
  );
}
