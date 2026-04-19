"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Zap } from "lucide-react";

type Step = "idle" | "click" | "window" | "authorizing" | "success" | "ready";

export function ByozOAuth() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    if (!inView) return;

    const sequence: { step: Step; delay: number }[] = [
      { step: "idle", delay: 800 },
      { step: "click", delay: 500 },
      { step: "window", delay: 700 },
      { step: "authorizing", delay: 1500 },
      { step: "success", delay: 1200 },
      { step: "ready", delay: 1800 },
    ];

    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const advance = () => {
      setStep(sequence[i].step);
      timeout = setTimeout(() => {
        i = (i + 1) % sequence.length;
        advance();
      }, sequence[i].delay);
    };

    advance();
    return () => clearTimeout(timeout);
  }, [inView]);

  return (
    <div ref={ref} className="relative rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-mono text-muted">foreman.otakusolutions.io</span>
        <span className="text-[10px] text-muted">secure · HTTPS</span>
      </div>

      <div className="p-6 sm:p-8 min-h-[320px] flex flex-col items-center justify-center gap-4">
        {/* The main Connect button */}
        <motion.button
          type="button"
          animate={{
            scale: step === "click" ? 0.95 : 1,
            borderColor: step === "ready" ? "var(--accent)" : "transparent",
          }}
          transition={{ duration: 0.2 }}
          className={`relative rounded-lg px-5 py-3 text-sm font-medium flex items-center gap-2 border-2 ${
            step === "ready"
              ? "bg-accent/10 text-accent border-accent"
              : "bg-foreground text-background border-transparent"
          }`}
        >
          <AnimatePresence mode="wait">
            {step === "ready" ? (
              <motion.span
                key="ready"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" /> Zapier connected
              </motion.span>
            ) : (
              <motion.span
                key="connect"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" /> Connect Zapier
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Popup window */}
        <AnimatePresence>
          {(step === "window" || step === "authorizing" || step === "success") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-400/70" />
                  <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
                  <span className="h-2 w-2 rounded-full bg-green-400/70" />
                </div>
                <span className="text-[10px] font-mono text-muted flex-1 truncate">
                  zapier.com/oauth/authorize
                </span>
                <ExternalLink className="h-3 w-3 text-muted" />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    Z
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Authorize Foreman</div>
                    <div className="text-[10px] text-muted">foreman wants to access your Zapier</div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {["Read connected apps", "Discover actions", "Run actions on approval"].map((perm, i) => (
                    <motion.div
                      key={perm}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{
                        opacity: step === "authorizing" || step === "success" ? 1 : 0.4,
                        x: 0,
                      }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <motion.div
                        animate={{
                          backgroundColor:
                            step === "authorizing" || step === "success"
                              ? "var(--accent)"
                              : "var(--border)",
                        }}
                        transition={{ delay: i * 0.15 }}
                        className="h-3.5 w-3.5 rounded flex items-center justify-center"
                      >
                        {(step === "authorizing" || step === "success") && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </motion.div>
                      <span>{perm}</span>
                    </motion.div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {step === "success" ? (
                    <motion.div
                      key="ok"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 text-sm text-accent font-medium"
                    >
                      <Check className="h-4 w-4" /> Authorized — redirecting…
                    </motion.div>
                  ) : (
                    <motion.button
                      key="btn"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      type="button"
                      className="w-full rounded-md bg-orange-500 text-white text-sm font-medium py-2"
                    >
                      Authorize
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
