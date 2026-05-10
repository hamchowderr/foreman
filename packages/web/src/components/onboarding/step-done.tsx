import { motion, type Variants } from "framer-motion";
import { ArrowRight, MessageSquare, ShieldCheck, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    label: "9,000+ apps at your fingertips",
    description: "Foreman can read and write across everything in your Zapier account.",
    color: "#FF4F00",
    bg: "#FFF3E6",
    border: "#FFBF6E",
  },
  {
    icon: MessageSquare,
    label: "Just talk to it",
    description:
      "No flows to build. Describe what you need in plain English and Foreman figures out the rest.",
    color: "#2B2358",
    bg: "#F0EEFF",
    border: "#C4BAF0",
  },
  {
    icon: ShieldCheck,
    label: "You approve every action",
    description: "Foreman asks before it acts. Nothing happens without your say-so.",
    color: "#2E7D32",
    bg: "#F0F7F0",
    border: "#A8D5A2",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export function StepDone() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="space-y-5 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#FFBF6E" }}
        >
          Step 4 of 4
        </motion.p>

        {/* Animated check */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-[20px]"
          style={{ backgroundColor: "#FFF3E6", border: "2px solid #FF4F00" }}
        >
          <motion.svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <motion.path
              d="M8 18.5L14.5 25L28 11"
              stroke="#FF4F00"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#201515" }}>
            You&apos;re all set.
          </h1>
          <p className="mx-auto max-w-sm text-base" style={{ color: "#6B5050" }}>
            Foreman is connected and ready. Here&apos;s what it can do for you.
          </p>
        </motion.div>
      </div>

      {/* Feature cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        {FEATURES.map(({ icon: Icon, label, description, color, bg, border }) => (
          <motion.div
            key={label}
            variants={item}
            className="flex items-start gap-4 rounded-2xl p-4"
            style={{ backgroundColor: bg, border: `1px solid ${border}` }}
          >
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color }} />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-snug" style={{ color: "#201515" }}>
                {label}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#6B5050" }}>
                {description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <a
          href="/chat"
          className="group flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: "#FF4F00" }}
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            F
          </span>
          Open Foreman
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </motion.div>
    </div>
  );
}
