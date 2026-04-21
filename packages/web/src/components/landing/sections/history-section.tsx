import { Reveal } from "@/components/landing/reveal";
import { HistorySearch } from "@/components/landing/demos/history-search";
import { Badge } from "@/components/ui/badge";

export function HistorySection() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Semantic action history</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              "What did I send to Jake last week?"
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Every action Foreman runs gets indexed with embeddings. Ask a
              fuzzy question and get the exact email, card, or invoice back —
              plus a relevance score. No keywords required.
            </p>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <HistorySearch />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
