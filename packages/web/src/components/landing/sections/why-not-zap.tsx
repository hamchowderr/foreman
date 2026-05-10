import { ZapVsForemanRace } from "@/components/landing/demos/zap-race";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";

export function WhyNotZap() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">
            Builder vs. driver
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Zapier Agents builds. Foreman drives.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Zapier Agents is a builder — you configure a named agent, seed its knowledge, pick its
            actions. Foreman is a driver — one agent over your whole Zapier account, no setup, no
            knowledge base to maintain. If your connections are already there, just talk to them.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ZapVsForemanRace />
        </Reveal>
      </div>
    </section>
  );
}
