import { ReasoningTrace as ReasoningTraceDemo } from "@/components/landing/demos/reasoning-trace";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";

export function ReasoningTrace() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">
            Show your work
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Foreman shows its work.
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed">
            Every prompt becomes a sequence of tool calls — lookups, discoveries, argument
            resolution. You see the full trace before anything writes, so you always know how it got
            to the draft.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ReasoningTraceDemo />
        </Reveal>
      </div>
    </section>
  );
}
