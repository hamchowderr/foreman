"use client";

import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { MessageSquare, Eye, Check } from "lucide-react";

const STEPS = [
  {
    num: "01",
    title: "Say it in plain English",
    body: "In Slack, web, voice, or any channel. No app name, no action name, no syntax.",
    icon: MessageSquare,
  },
  {
    num: "02",
    title: "Review the draft",
    body: "Foreman picks the right app and action, fills every field, and shows you exactly what it's about to do.",
    icon: Eye,
  },
  {
    num: "03",
    title: "Approve and it runs",
    body: "One click. Audit trail in your action history. Save it as a workflow if you'll use it again.",
    icon: Check,
  },
];

export function HowItWorksScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 40%"],
  });

  const lineWidth = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "100%"]);

  return (
    <div ref={ref} className="relative">
      {/* Progress line (desktop only) */}
      <div className="hidden md:block absolute top-[42px] left-[8%] right-[8%] h-0.5 bg-border rounded-full overflow-hidden">
        <motion.div
          style={reduce ? { width: "100%" } : { width: lineWidth }}
          className="h-full bg-gradient-to-r from-accent/60 via-accent to-accent/60"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {STEPS.map((step, i) => {
          const start = 0.1 + i * 0.25;
          const end = start + 0.15;
          return (
            <StepCard
              key={step.num}
              step={step}
              index={i}
              start={start}
              end={end}
              scrollProgress={scrollYProgress}
              reduce={!!reduce}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  start,
  end,
  scrollProgress,
  reduce,
}: {
  step: (typeof STEPS)[0];
  index: number;
  start: number;
  end: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  reduce: boolean;
}) {
  const opacity = useTransform(scrollProgress, [start - 0.05, start], [0.4, 1]);
  const scale = useTransform(scrollProgress, [start - 0.05, start], [0.96, 1]);
  const dotScale = useTransform(scrollProgress, [start, end], [1, 1.15]);
  const dotBg = useTransform(
    scrollProgress,
    [start, end],
    ["var(--border)", "var(--accent)"],
  );

  return (
    <motion.div
      style={reduce ? {} : { opacity, scale }}
      className="relative rounded-xl bg-background border border-border/60 p-6 pt-8"
    >
      {/* Dot marker on line */}
      <motion.div
        style={reduce ? {} : { scale: dotScale, backgroundColor: dotBg }}
        className="hidden md:block absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full ring-4 ring-background"
      />
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <step.icon className="h-5 w-5" />
        </div>
        <span className="text-accent font-mono text-sm font-semibold">{step.num}</span>
      </div>
      <h3 className="font-semibold mb-2">{step.title}</h3>
      <p className="text-sm text-muted leading-relaxed">{step.body}</p>
    </motion.div>
  );
}
