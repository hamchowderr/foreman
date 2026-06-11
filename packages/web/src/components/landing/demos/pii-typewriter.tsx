"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { CreditCard, IdCard, Key, Lock, Mail, Phone, ScanEye } from "@/components/icons/hi";

type Token = {
  text: string;
  sensitive?: "email" | "phone" | "ssn" | "key" | "card";
};

const SCRIPTS: Token[][] = [
  [
    { text: "Forwarded the invoice to " },
    { text: "jamie@acme.com", sensitive: "email" },
    { text: ". Their AmEx on file is " },
    { text: "3782 822463 10005", sensitive: "card" },
    { text: ", and the API token " },
    { text: "sk_live_51HxK", sensitive: "key" },
    { text: " unlocks the export." },
  ],
  [
    { text: "Added Priya Shah to the CRM — mobile " },
    { text: "(415) 555-0199", sensitive: "phone" },
    { text: ", SSN on file " },
    { text: "123-45-6789", sensitive: "ssn" },
    { text: ". Confirmation sent to " },
    { text: "priya.shah@acme.com", sensitive: "email" },
    { text: "." },
  ],
  [
    { text: "Noah's Stripe card " },
    { text: "4242 4242 4242 4242", sensitive: "card" },
    { text: " was declined. Slack DM at " },
    { text: "noah@acme.com", sensitive: "email" },
    { text: " with webhook key " },
    { text: "whsec_3Q9x7mL", sensitive: "key" },
    { text: " for reprocessing." },
  ],
];

const REDACTED_LABELS: Record<NonNullable<Token["sensitive"]>, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  ssn: "[SSN]",
  key: "[API_KEY]",
  card: "[CARD]",
};

const TOKEN_DELAY = 260;
const REDACT_AFTER = 700;
const RESTART_AFTER = 5500;

export function PiiTypewriter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const [scriptIdx, setScriptIdx] = useState(0);
  const [tokensShown, setTokensShown] = useState(0);
  const [redacted, setRedacted] = useState(false);

  const script = SCRIPTS[scriptIdx];

  useEffect(() => {
    if (!inView) return;

    setTokensShown(0);
    setRedacted(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= script.length; i++) {
      timers.push(setTimeout(() => setTokensShown(i), i * TOKEN_DELAY));
    }

    const doneAt = script.length * TOKEN_DELAY;
    timers.push(setTimeout(() => setRedacted(true), doneAt + REDACT_AFTER));
    timers.push(
      setTimeout(() => {
        setScriptIdx((i) => (i + 1) % SCRIPTS.length);
      }, doneAt + RESTART_AFTER),
    );

    return () => timers.forEach(clearTimeout);
  }, [inView, scriptIdx, script.length]);

  const typing = tokensShown < script.length;
  const visible = script.slice(0, tokensShown);

  return (
    <div ref={ref} className="relative">
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xl shadow-black/5">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <ScanEye className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-medium text-muted-foreground truncate">
              Sensitive data filter
            </span>
          </div>
          <motion.span
            animate={{ color: redacted ? "var(--accent)" : "var(--muted)" }}
            className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1"
          >
            <Lock className="h-3 w-3" />
            {redacted ? "redacted" : "scanning"}
          </motion.span>
        </div>
        <div className="p-5 sm:p-6 min-h-[200px] text-sm sm:text-base leading-relaxed font-mono">
          <p className="break-words">
            {visible.map((token, i) => {
              if (!token.sensitive) {
                return <span key={i}>{token.text}</span>;
              }
              return (
                <SensitiveToken
                  key={i}
                  raw={token.text}
                  label={REDACTED_LABELS[token.sensitive]}
                  redacted={redacted}
                />
              );
            })}
            {typing && (
              <span className="inline-block w-[2px] h-[1em] bg-accent align-text-bottom ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
        <div className="px-5 py-3 border-t border-border bg-background/50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] sm:text-xs text-muted-foreground">
          <Metric label="emails" Icon={Mail} />
          <Metric label="phones" Icon={Phone} />
          <Metric label="SSNs" Icon={IdCard} />
          <Metric label="API keys" Icon={Key} />
          <Metric label="cards" Icon={CreditCard} />
        </div>
      </div>
    </div>
  );
}

function SensitiveToken({
  raw,
  label,
  redacted,
}: {
  raw: string;
  label: string;
  redacted: boolean;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {redacted ? (
        <motion.span
          key="red"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded bg-accent/15 text-accent px-1.5 py-0.5 font-semibold text-xs sm:text-sm whitespace-nowrap"
        >
          {label}
        </motion.span>
      ) : (
        <motion.span
          key="raw"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(3px)" }}
          transition={{ duration: 0.25 }}
          className="rounded bg-red-500/10 text-red-600 dark:text-red-400 px-1 py-0.5 border border-red-500/20 whitespace-nowrap"
        >
          {raw}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Metric({ label, Icon }: { label: string; Icon: ComponentType<{ className?: string }> }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-accent" />
      <span>{label}</span>
    </span>
  );
}
