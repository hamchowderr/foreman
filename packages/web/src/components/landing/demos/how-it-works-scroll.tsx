"use client";

import { motion } from "motion/react";
import { Check, Eye, MessageSquare } from "@/components/icons/hi";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";

const STEPS = [
  {
    num: "01",
    title: "Say it in plain English",
    body: "In Slack, web, voice, or any channel. No app name, no action name, no syntax.",
    icon: MessageSquare,
    preview: (
      <div className="rounded-lg bg-background/70 border border-border/50 p-3 text-[11px] font-mono text-muted">
        <span className="text-accent">you</span> email Jake the Q3 deck
      </div>
    ),
  },
  {
    num: "02",
    title: "Review the draft",
    body: "Foreman picks the right app and action, fills every field, and shows you exactly what it's about to do.",
    icon: Eye,
    preview: (
      <div className="rounded-lg bg-background/70 border border-border/50 p-3 space-y-1 text-[11px] font-mono">
        <div className="flex gap-2">
          <span className="text-muted w-8">to</span>
          <span>jake@acme.com</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted w-8">re</span>
          <span>Q3 deck</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted w-8">file</span>
          <span>Q3-Review.pdf</span>
        </div>
      </div>
    ),
  },
  {
    num: "03",
    title: "Approve and it runs",
    body: "One click. Audit trail in your action history. Save it as a workflow if you'll use it again.",
    icon: Check,
    preview: (
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-[11px] font-mono text-green-600 dark:text-green-400 flex items-center gap-2">
        <Check className="h-3.5 w-3.5" />
        Sent via Gmail.
      </div>
    ),
  },
];

export function HowItWorksScroll() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="hidden md:block absolute top-[68px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
      />

      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

type Step = (typeof STEPS)[number];

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      <TiltedSpotlight>
        <div className="rounded-2xl border border-border/60 bg-background p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20">
              <step.icon className="h-5 w-5" />
            </div>
            <span className="text-accent font-mono text-sm font-semibold">{step.num}</span>
          </div>
          <h3 className="font-semibold mb-2">{step.title}</h3>
          <p className="text-sm text-muted leading-relaxed mb-5">{step.body}</p>
          {step.preview}
        </div>
      </TiltedSpotlight>
    </motion.div>
  );
}
