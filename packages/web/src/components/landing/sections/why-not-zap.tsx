import { Reveal } from "@/components/landing/reveal";
import { ZapVsForemanRace } from "@/components/landing/demos/zap-race";
import { Badge } from "@/components/ui/badge";

export function WhyNotZap() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">For existing Zapier users</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Why build a Zap for every little thing?
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Zaps are for recurring automations. Zapier Copilot helps you build them.
            Foreman skips the building — it executes actions, manages tables, and
            queries your apps directly. No triggers, no paths, no canvas. Watch them race.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ZapVsForemanRace />
        </Reveal>
      </div>
    </section>
  );
}
