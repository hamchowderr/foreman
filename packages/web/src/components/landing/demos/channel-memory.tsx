"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Brain, Globe } from "@/components/icons/hi";
import {
  SlackBrand,
  TelegramBrand,
  DiscordBrand,
  BRAND_COLORS,
} from "@/components/icons/brands";
import type { ComponentType } from "react";

type ChannelId = "slack" | "telegram" | "discord" | "web";

type Frame = {
  from: ChannelId;
  to: ChannelId;
  userMsg: string;
  agentMsg: string;
};

const FRAMES: Frame[] = [
  {
    from: "slack",
    to: "telegram",
    userMsg: "Who am I meeting Thursday?",
    agentMsg: "Priya and Noah at 2pm in Conference Room B.",
  },
  {
    from: "telegram",
    to: "web",
    userMsg: "Move Priya to 3pm",
    agentMsg: "Moved to 3pm. Priya confirmed.",
  },
  {
    from: "web",
    to: "discord",
    userMsg: "Any updates from Priya?",
    agentMsg: "She confirmed the 3pm slot 10 min ago.",
  },
  {
    from: "discord",
    to: "slack",
    userMsg: "Reschedule Noah too",
    agentMsg: "Done. Noah now at 3:30pm. Both notified.",
  },
];

type IconComp = ComponentType<{ size?: number; color?: string; className?: string }>;

const CHANNELS: Record<
  ChannelId,
  {
    label: string;
    Icon: IconComp;
    brand: string;
    brandText: string;
  }
> = {
  slack: {
    label: "Slack",
    Icon: SlackBrand,
    brand: BRAND_COLORS.slack,
    brandText: "#ffffff",
  },
  telegram: {
    label: "Telegram",
    Icon: TelegramBrand,
    brand: BRAND_COLORS.telegram,
    brandText: "#ffffff",
  },
  discord: {
    label: "Discord",
    Icon: DiscordBrand,
    brand: BRAND_COLORS.discord,
    brandText: "#ffffff",
  },
  web: {
    label: "Web",
    Icon: Globe,
    brand: BRAND_COLORS.zapier,
    brandText: "#ffffff",
  },
};

export function ChannelMemory() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [frameIdx, setFrameIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "user-sent" | "brain-in" | "brain-out" | "agent-replied">("idle");

  useEffect(() => {
    if (!inView) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const run = () => {
      if (cancelled) return;

      setPhase("idle");
      timers.push(setTimeout(() => !cancelled && setPhase("user-sent"), 600));
      timers.push(setTimeout(() => !cancelled && setPhase("brain-in"), 1500));
      timers.push(setTimeout(() => !cancelled && setPhase("brain-out"), 2500));
      timers.push(setTimeout(() => !cancelled && setPhase("agent-replied"), 3200));
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setFrameIdx((f) => (f + 1) % FRAMES.length);
          run();
        }, 5000),
      );
    };

    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView]);

  const frame = FRAMES[frameIdx];

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-mono text-muted">shared memory</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted hidden sm:inline">
          one user · any channel
        </span>
      </div>

      <div className="relative aspect-square sm:aspect-[4/3] p-3 sm:p-5">
        {/* 4 mini chat windows in a grid around the brain */}
        <div className="relative grid grid-cols-2 grid-rows-2 gap-3 sm:gap-5 h-full">
          {(Object.keys(CHANNELS) as ChannelId[]).map((id) => {
            const ch = CHANNELS[id];
            const isSource = id === frame.from;
            const isTarget = id === frame.to;
            const active = isSource || isTarget;

            const showUserMsg = isSource && (phase === "user-sent" || phase === "brain-in" || phase === "brain-out" || phase === "agent-replied");
            const showAgentMsg = isTarget && phase === "agent-replied";

            return (
              <motion.div
                key={id}
                animate={{
                  opacity: active ? 1 : 0.55,
                  scale: active ? 1 : 0.97,
                }}
                transition={{ duration: 0.35 }}
                className={`rounded-xl overflow-hidden border transition-colors min-h-0 flex flex-col ${
                  active ? "border-accent/30 bg-background shadow-md" : "border-border bg-background/50"
                }`}
              >
                {/* Channel header */}
                <div
                  className="px-2.5 py-1.5 flex items-center gap-1.5 shrink-0"
                  style={{ backgroundColor: ch.brand, color: ch.brandText }}
                >
                  <ch.Icon size={13} color={ch.brandText} />
                  <span className="text-[10px] sm:text-[11px] font-semibold truncate">{ch.label}</span>
                </div>
                {/* Chat body */}
                <div className="flex-1 min-h-0 p-2 sm:p-2.5 flex flex-col justify-end gap-1.5 overflow-hidden">
                  <AnimatePresence>
                    {showUserMsg && (
                      <motion.div
                        key={`user-${frameIdx}`}
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="self-end max-w-[90%] rounded-lg rounded-br-sm bg-foreground text-background px-2 py-1 text-[9px] sm:text-[10px] leading-snug"
                      >
                        {frame.userMsg}
                      </motion.div>
                    )}
                    {showAgentMsg && (
                      <motion.div
                        key={`agent-${frameIdx}`}
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="self-start max-w-[92%] rounded-lg rounded-bl-sm bg-accent/15 text-accent border border-accent/25 px-2 py-1 text-[9px] sm:text-[10px] leading-snug"
                      >
                        {frame.agentMsg}
                      </motion.div>
                    )}
                    {!showUserMsg && !showAgentMsg && (
                      <motion.div
                        key={`placeholder-${id}-${frameIdx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: active ? 0 : 0.3 }}
                        exit={{ opacity: 0 }}
                        className="self-center my-auto text-[9px] text-muted/40 italic"
                      >
                        {active ? "" : "·"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Central brain, layered on top */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{
              scale: phase === "brain-in" || phase === "brain-out" ? 1.12 : 1,
              boxShadow:
                phase === "brain-in" || phase === "brain-out"
                  ? "0 0 40px 10px rgba(255, 74, 0, 0.45)"
                  : "0 0 18px 3px rgba(255, 74, 0, 0.2)",
            }}
            transition={{ duration: 0.4 }}
            className="relative h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center ring-4 ring-background"
          >
            <Brain className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
          </motion.div>
        </div>

        {/* Flowing particle between source and target through the brain */}
        <AnimatePresence>
          {phase === "brain-in" && <FlowParticle from={frame.from} to="center" key={`in-${frameIdx}`} />}
          {phase === "brain-out" && <FlowParticle from="center" to={frame.to} key={`out-${frameIdx}`} />}
        </AnimatePresence>
      </div>

      {/* Footer caption */}
      <div className="px-4 sm:px-5 py-3 border-t border-border bg-background/50 text-xs text-muted flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 truncate">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: CHANNELS[frame.from].brand }}
          />
          <span className="font-medium">{CHANNELS[frame.from].label}</span>
          <span>→</span>
          <Brain className="h-3 w-3 text-accent shrink-0" />
          <span>→</span>
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: CHANNELS[frame.to].brand }}
          />
          <span className="font-medium">{CHANNELS[frame.to].label}</span>
        </span>
        <span className="text-[10px] uppercase tracking-widest shrink-0">same user</span>
      </div>
    </div>
  );
}

function FlowParticle({
  from,
  to,
}: {
  from: ChannelId | "center";
  to: ChannelId | "center";
}) {
  const positions: Record<ChannelId | "center", { x: string; y: string }> = {
    slack: { x: "25%", y: "28%" },
    telegram: { x: "75%", y: "28%" },
    discord: { x: "25%", y: "72%" },
    web: { x: "75%", y: "72%" },
    center: { x: "50%", y: "50%" },
  };
  const start = positions[from];
  const end = positions[to];

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: start.x, top: start.y }}
      initial={{ x: "-50%", y: "-50%", opacity: 0 }}
      animate={{
        left: end.x,
        top: end.y,
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 0.8, ease: "easeInOut", times: [0, 0.2, 0.8, 1] }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(255,74,0,0.8)]" />
    </motion.div>
  );
}
