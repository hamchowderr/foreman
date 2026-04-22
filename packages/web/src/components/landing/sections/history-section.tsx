"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Reveal } from "@/components/landing/reveal";
import { HistorySearch, HISTORY_QUERIES } from "@/components/landing/demos/history-search";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";

export function HistorySection() {
  const [queryIdx, setQueryIdx] = useState(0);
  const advance = useCallback(() => {
    setQueryIdx((q) => (q + 1) % HISTORY_QUERIES.length);
  }, []);

  const headline = HISTORY_QUERIES[queryIdx].headline;

  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Semantic action history</Badge>
            <div className="relative min-h-[5rem] sm:min-h-[6rem]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={queryIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]"
                >
                  {headline}
                </motion.h2>
              </AnimatePresence>
            </div>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Every action Foreman runs gets indexed with embeddings. Ask a
              fuzzy question and get the exact email, card, or invoice back —
              plus a relevance score. No keywords required.
            </p>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <TiltedSpotlight>
              <HistorySearch queryIdx={queryIdx} onQueryAdvance={advance} />
            </TiltedSpotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
