"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Shield, Lock } from "@/components/icons/hi";

type Token = {
  text: string;
  sensitive?: "email" | "phone" | "ssn" | "key" | "card";
};

const SCRIPT: Token[] = [
  { text: "Forwarded the invoice to " },
  { text: "jamie@acme.com", sensitive: "email" },
  { text: ". Their AmEx on file is " },
  { text: "3782 822463 10005", sensitive: "card" },
  { text: ", and the API token " },
  { text: "sk_live_51HxK2fL", sensitive: "key" },
  { text: " unlocks the export. SSN for W-9 is " },
  { text: "123-45-6789", sensitive: "ssn" },
  { text: ". Call them at " },
  { text: "(415) 555-0199", sensitive: "phone" },
  { text: " if anything." },
];

const REDACTED_LABELS: Record<NonNullable<Token["sensitive"]>, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  ssn: "[SSN]",
  key: "[API_KEY]",
  card: "[CARD]",
};

const CHAR_DELAY = 18;

export function PiiTypewriter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const [typedChars, setTypedChars] = useState(0);
  const [redacted, setRedacted] = useState(false);

  const fullText = SCRIPT.map((t) => t.text).join("");
  const totalChars = fullText.length;

  useEffect(() => {
    if (!inView) return;

    setTypedChars(0);
    setRedacted(false);

    let charTimer: ReturnType<typeof setInterval> | null = null;
    let redactTimer: ReturnType<typeof setTimeout> | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    charTimer = setInterval(() => {
      setTypedChars((prev) => {
        const next = prev + 1;
        if (next >= totalChars) {
          if (charTimer) clearInterval(charTimer);
          redactTimer = setTimeout(() => setRedacted(true), 700);
          restartTimer = setTimeout(() => {
            setTypedChars(0);
            setRedacted(false);
          }, 5500);
        }
        return next;
      });
    }, CHAR_DELAY);

    return () => {
      if (charTimer) clearInterval(charTimer);
      if (redactTimer) clearTimeout(redactTimer);
      if (restartTimer) clearTimeout(restartTimer);
    };
  }, [inView, totalChars]);

  // Build visible tokens up to typedChars
  let remaining = typedChars;
  const visible = SCRIPT.map((token) => {
    const take = Math.min(remaining, token.text.length);
    remaining -= take;
    return { ...token, visibleText: token.text.slice(0, take), complete: take === token.text.length };
  });

  return (
    <div ref={ref} className="relative">
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xl shadow-black/5">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-xs font-mono text-muted truncate">
              output-processor.ts
            </span>
          </div>
          <motion.span
            animate={{
              color: redacted ? "var(--accent)" : "var(--muted)",
            }}
            className="text-[10px] uppercase tracking-widest font-medium flex items-center gap-1"
          >
            <Lock className="h-3 w-3" />
            {redacted ? "redacted" : "scanning"}
          </motion.span>
        </div>
        <div className="p-5 sm:p-6 min-h-[180px] text-sm sm:text-base leading-relaxed font-mono">
          <p className="break-words">
            {visible.map((token, i) => {
              if (!token.sensitive) {
                return <span key={i}>{token.visibleText}</span>;
              }
              const showRedacted = redacted && token.complete;
              return (
                <span key={i} className="relative inline-block align-baseline">
                  <AnimatePresence mode="wait" initial={false}>
                    {showRedacted ? (
                      <motion.span
                        key="red"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="inline-block rounded bg-accent/15 text-accent px-1.5 py-0.5 font-semibold text-xs sm:text-sm align-middle"
                      >
                        {REDACTED_LABELS[token.sensitive]}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="raw"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: 4, filter: "blur(3px)" }}
                        transition={{ duration: 0.25 }}
                        className="inline-block rounded bg-red-500/10 text-red-600 dark:text-red-400 px-1 py-0.5 border border-red-500/20"
                      >
                        {token.visibleText}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              );
            })}
            {typedChars < totalChars && (
              <span className="inline-block w-[2px] h-[1em] bg-accent align-text-bottom ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
        <div className="px-5 py-3 border-t border-border bg-background/50 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] sm:text-xs text-muted">
          <Metric label="emails" />
          <Metric label="phones" />
          <Metric label="SSNs" />
          <Metric label="API keys" />
          <Metric label="cards" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-1 w-1 rounded-full bg-accent" />
      <span>{label}</span>
    </span>
  );
}
