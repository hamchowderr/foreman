"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Search, History, Mail, Calendar, CreditCard, FileText } from "lucide-react";

type Result = {
  icon: typeof Mail;
  app: string;
  title: string;
  snippet: string;
  date: string;
  score: number;
};

type Query = {
  text: string;
  results: Result[];
};

const QUERIES: Query[] = [
  {
    text: "what did I send to Jake last week",
    results: [
      { icon: Mail, app: "Gmail", title: "Q3 deck for Thursday", snippet: "Attaching the Q3 review deck — let me know…", date: "Tue 2:14 PM", score: 0.94 },
      { icon: FileText, app: "Notion", title: "Shared doc: Q3 notes", snippet: "Edited by Foreman on behalf of you…", date: "Mon 11:02 AM", score: 0.81 },
      { icon: Calendar, app: "Google Calendar", title: "Q3 review (Jake, Priya)", snippet: "Scheduled for Thursday 2pm…", date: "Mon 10:55 AM", score: 0.72 },
    ],
  },
  {
    text: "invoices from March",
    results: [
      { icon: CreditCard, app: "Stripe", title: "Invoice #INV-2091 paid", snippet: "Acme Corp · $12,400.00 · Paid 3/28…", date: "Mar 28", score: 0.96 },
      { icon: Mail, app: "Gmail", title: "Re: March invoice batch", snippet: "Forwarded to accounting — Jamie will handle…", date: "Mar 22", score: 0.88 },
      { icon: CreditCard, app: "Stripe", title: "Invoice #INV-2084 sent", snippet: "Globex Inc · $4,900.00 · Due Mar 31…", date: "Mar 15", score: 0.76 },
    ],
  },
];

export function HistorySearch() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [queryIdx, setQueryIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const query = QUERIES[queryIdx];
    setTyped("");
    setShowResults(false);

    let idx = 0;
    const typeInterval = setInterval(() => {
      idx++;
      setTyped(query.text.slice(0, idx));
      if (idx >= query.text.length) {
        clearInterval(typeInterval);
        setTimeout(() => setShowResults(true), 300);
        setTimeout(() => setQueryIdx((q) => (q + 1) % QUERIES.length), 5500);
      }
    }, 40);

    return () => clearInterval(typeInterval);
  }, [queryIdx, inView]);

  const query = QUERIES[queryIdx];

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-mono text-muted">action-history · semantic</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <span className="text-sm flex-1 min-w-0">
            {typed}
            {!showResults && (
              <span className="inline-block w-[2px] h-[1em] bg-accent align-text-bottom ml-0.5 animate-pulse" />
            )}
          </span>
        </div>

        <div className="mt-4 space-y-1.5 min-h-[240px]">
          <AnimatePresence mode="popLayout">
            {showResults &&
              query.results.map((result, i) => (
                <motion.div
                  key={`${queryIdx}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-lg border border-border bg-background p-3 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                      <result.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm truncate">{result.title}</span>
                        <span className="text-[10px] font-mono text-muted tabular-nums shrink-0">
                          {(result.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">{result.snippet}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
                        <span>{result.app}</span>
                        <span>·</span>
                        <span>{result.date}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
