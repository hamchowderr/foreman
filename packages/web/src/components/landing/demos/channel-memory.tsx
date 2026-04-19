"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Brain, MessageSquare } from "lucide-react";
import { SlackIcon, TelegramIcon, DiscordIcon, GlobeIcon } from "@/components/icons";

type Frame = {
  from: "slack" | "telegram" | "discord" | "web";
  to: "slack" | "telegram" | "discord" | "web";
  userMsg: string;
  agentMsg: string;
};

const FRAMES: Frame[] = [
  {
    from: "slack",
    to: "telegram",
    userMsg: "Who do I meet with on Thursday?",
    agentMsg: "Calendar shows Priya and Noah at 2pm.",
  },
  {
    from: "telegram",
    to: "web",
    userMsg: "Move the Priya meeting to 3pm",
    agentMsg: "Moved to 3pm. Priya notified.",
  },
  {
    from: "web",
    to: "discord",
    userMsg: "Any updates from Priya?",
    agentMsg: "Confirmed 3pm. She replied 10 min ago.",
  },
];

const CHANNELS = [
  { id: "slack", label: "Slack", Icon: SlackIcon, angle: 0 },
  { id: "telegram", label: "Telegram", Icon: TelegramIcon, angle: 90 },
  { id: "web", label: "Web", Icon: GlobeIcon, angle: 180 },
  { id: "discord", label: "Discord", Icon: DiscordIcon, angle: 270 },
] as const;

export function ChannelMemory() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: false });
  const [frameIdx, setFrameIdx] = useState(0);
  const [phase, setPhase] = useState<"user" | "to-brain" | "from-brain" | "agent">("user");

  useEffect(() => {
    if (!inView) return;

    const sequence = [
      { phase: "user" as const, delay: 1200 },
      { phase: "to-brain" as const, delay: 800 },
      { phase: "from-brain" as const, delay: 800 },
      { phase: "agent" as const, delay: 1600 },
    ];

    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const step = () => {
      const current = sequence[i % sequence.length];
      setPhase(current.phase);
      timeout = setTimeout(() => {
        i++;
        if (i % sequence.length === 0) {
          setFrameIdx((f) => (f + 1) % FRAMES.length);
        }
        step();
      }, current.delay);
    };

    step();
    return () => clearTimeout(timeout);
  }, [inView]);

  const frame = FRAMES[frameIdx];
  const fromChannel = CHANNELS.find((c) => c.id === frame.from)!;
  const toChannel = CHANNELS.find((c) => c.id === frame.to)!;

  return (
    <div ref={ref} className="relative rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-mono text-muted">shared-memory</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted">
          same user · any channel
        </span>
      </div>

      <div className="relative aspect-[4/3] sm:aspect-[16/10] p-4 sm:p-8">
        {/* Central brain */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{
              scale: phase === "to-brain" || phase === "from-brain" ? 1.08 : 1,
              boxShadow:
                phase === "to-brain" || phase === "from-brain"
                  ? "0 0 40px 8px rgba(255, 74, 0, 0.4)"
                  : "0 0 20px 2px rgba(255, 74, 0, 0.15)",
            }}
            transition={{ duration: 0.4 }}
            className="relative z-10 h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center"
          >
            <Brain className="h-6 w-6 sm:h-9 sm:w-9 text-white" />
          </motion.div>
        </div>

        {/* Channel nodes */}
        {CHANNELS.map((ch) => {
          const isSource = ch.id === frame.from;
          const isTarget = ch.id === frame.to;
          const active = isSource || isTarget;

          // Position: top, right, bottom, left based on angle
          const positions: Record<number, string> = {
            0: "top-2 sm:top-6 left-1/2 -translate-x-1/2",
            90: "right-2 sm:right-6 top-1/2 -translate-y-1/2",
            180: "bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2",
            270: "left-2 sm:left-6 top-1/2 -translate-y-1/2",
          };

          return (
            <motion.div
              key={ch.id}
              animate={{
                scale: active ? 1.05 : 1,
                opacity: active ? 1 : 0.55,
              }}
              transition={{ duration: 0.3 }}
              className={`absolute ${positions[ch.angle]} flex flex-col items-center gap-1.5`}
            >
              <div
                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl border flex items-center justify-center transition-colors ${
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-muted"
                }`}
              >
                <ch.Icon size={18} />
              </div>
              <span className="text-[10px] sm:text-xs text-muted font-medium">
                {ch.label}
              </span>
            </motion.div>
          );
        })}

        {/* SVG lines between source/target and brain */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <defs>
            <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <AnimatePresence>
            {phase === "to-brain" && (
              <motion.line
                key={`in-${fromChannel.id}-${frameIdx}`}
                x1={`${nodeXPct(fromChannel.angle)}%`}
                y1={`${nodeYPct(fromChannel.angle)}%`}
                x2="50%"
                y2="50%"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            )}
            {phase === "from-brain" && (
              <motion.line
                key={`out-${toChannel.id}-${frameIdx}`}
                x1="50%"
                y1="50%"
                x2={`${nodeXPct(toChannel.angle)}%`}
                y2={`${nodeYPct(toChannel.angle)}%`}
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>
        </svg>
      </div>

      {/* Transcript */}
      <div className="px-4 sm:px-5 py-4 border-t border-border bg-background/50 space-y-2 min-h-[110px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`transcript-${frameIdx}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-2"
          >
            <div className="flex items-start gap-2 text-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mt-1 w-16 shrink-0">
                {fromChannel.label}
              </span>
              <span className="flex-1 truncate">
                <MessageSquare className="inline h-3 w-3 text-muted mr-1" />
                {frame.userMsg}
              </span>
            </div>
            {(phase === "agent" || phase === "from-brain") && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent mt-1 w-16 shrink-0">
                  {toChannel.label}
                </span>
                <span className="flex-1 text-muted">
                  <Brain className="inline h-3 w-3 text-accent mr-1" />
                  {frame.agentMsg}
                </span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function nodeXPct(angle: number): number {
  if (angle === 0 || angle === 180) return 50;
  if (angle === 90) return 88;
  return 12;
}
function nodeYPct(angle: number): number {
  if (angle === 90 || angle === 270) return 50;
  if (angle === 0) return 15;
  return 85;
}
