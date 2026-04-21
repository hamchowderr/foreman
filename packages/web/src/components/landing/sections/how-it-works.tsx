import { Reveal } from "@/components/landing/reveal";
import { HowItWorksScroll } from "@/components/landing/demos/how-it-works-scroll";
import { Badge } from "@/components/ui/badge";

export function HowItWorks() {
  return (
    <section id="how" className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-12 sm:mb-16">
          <Badge variant="accent" className="mb-4">How it works</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Three steps. No configuration.
          </h2>
        </Reveal>
        <HowItWorksScroll />
      </div>
    </section>
  );
}
