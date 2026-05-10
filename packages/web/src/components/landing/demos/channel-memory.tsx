"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import {
  BRAND_COLORS,
  DiscordBrand,
  GithubBrand,
  GoogleBrand,
  SlackBrand,
  TelegramBrand,
} from "@/components/icons/brands";
import { Brain, Cpu, Globe, Terminal } from "@/components/icons/hi";

type ChannelId = "slack" | "telegram" | "discord" | "web" | "github" | "google" | "mcp" | "a2a";

type Position = "tl" | "tr" | "bl" | "br";

type Frame = {
  /** Exactly 4 channels — one per grid slot. */
  slots: Record<Position, ChannelId>;
  from: Position;
  to: Position;
};

const USER_MSG = "Who am I meeting Thursday?";
const AGENT_MSG = "Priya and Noah at 2pm in Conference Room B.";

const FRAMES: Frame[] = [
  {
    slots: { tl: "slack", tr: "telegram", bl: "discord", br: "web" },
    from: "tl",
    to: "tr",
  },
  {
    slots: { tl: "telegram", tr: "github", bl: "web", br: "google" },
    from: "tl",
    to: "br",
  },
  {
    slots: { tl: "google", tr: "mcp", bl: "slack", br: "a2a" },
    from: "br",
    to: "bl",
  },
  {
    slots: { tl: "discord", tr: "web", bl: "github", br: "telegram" },
    from: "tr",
    to: "bl",
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
  slack: { label: "Slack", Icon: SlackBrand, brand: BRAND_COLORS.slack, brandText: "#ffffff" },
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
  web: { label: "Web", Icon: Globe, brand: BRAND_COLORS.zapier, brandText: "#ffffff" },
  github: { label: "GitHub", Icon: GithubBrand, brand: "#1f2328", brandText: "#ffffff" },
  google: { label: "Google Chat", Icon: GoogleBrand, brand: "#1a73e8", brandText: "#ffffff" },
  mcp: { label: "MCP", Icon: Terminal, brand: "#0f172a", brandText: "#ffffff" },
  a2a: { label: "A2A", Icon: Cpu, brand: "#334155", brandText: "#ffffff" },
};

const POSITIONS: Position[] = ["tl", "tr", "bl", "br"];

export function ChannelMemory() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [frameIdx, setFrameIdx] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "user-sent" | "brain-in" | "brain-out" | "agent-replied"
  >("idle");

  useEffect(() => {
    if (!inView) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
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
  const fromChannel = CHANNELS[frame.slots[frame.from]];
  const toChannel = CHANNELS[frame.slots[frame.to]];

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-border bg-surface overflow-hidden w-full flex flex-col"
    >
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
        <div className="relative grid grid-cols-2 grid-rows-2 gap-3 sm:gap-5 h-full">
          {POSITIONS.map((pos) => {
            const channelId = frame.slots[pos];
            const ch = CHANNELS[channelId];
            const isSource = pos === frame.from;
            const isTarget = pos === frame.to;
            const active = isSource || isTarget;

            const showUserMsg =
              isSource &&
              (phase === "user-sent" ||
                phase === "brain-in" ||
                phase === "brain-out" ||
                phase === "agent-replied");
            const showAgentMsg = isTarget && phase === "agent-replied";

            return (
              <motion.div
                key={pos}
                animate={{ opacity: active ? 1 : 0.55, scale: active ? 1 : 0.97 }}
                transition={{ duration: 0.35 }}
                className={`rounded-xl overflow-hidden border transition-colors min-h-0 flex flex-col ${
                  active
                    ? "border-accent/30 bg-background shadow-md"
                    : "border-border bg-background/50"
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={channelId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="px-2.5 py-1.5 flex items-center gap-1.5 shrink-0"
                    style={{ backgroundColor: ch.brand, color: ch.brandText }}
                  >
                    <ch.Icon size={13} color={ch.brandText} />
                    <span className="text-[10px] sm:text-[11px] font-semibold truncate">
                      {ch.label}
                    </span>
                  </motion.div>
                </AnimatePresence>
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
                        {USER_MSG}
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
                        {AGENT_MSG}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

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

        <AnimatePresence>
          {phase === "brain-in" && (
            <FlowParticle from={frame.from} to="center" key={`in-${frameIdx}`} />
          )}
          {phase === "brain-out" && (
            <FlowParticle from="center" to={frame.to} key={`out-${frameIdx}`} />
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-border bg-background/50 text-xs text-muted flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 truncate">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: fromChannel.brand }}
          />
          <span className="font-medium">{fromChannel.label}</span>
          <span>→</span>
          <Brain className="h-3 w-3 text-accent shrink-0" />
          <span>→</span>
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: toChannel.brand }}
          />
          <span className="font-medium">{toChannel.label}</span>
        </span>
        <span className="text-[10px] uppercase tracking-widest shrink-0">same user</span>
      </div>
    </div>
  );
}

function FlowParticle({ from, to }: { from: Position | "center"; to: Position | "center" }) {
  const positions: Record<Position | "center", { x: string; y: string }> = {
    tl: { x: "25%", y: "28%" },
    tr: { x: "75%", y: "28%" },
    bl: { x: "25%", y: "72%" },
    br: { x: "75%", y: "72%" },
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
