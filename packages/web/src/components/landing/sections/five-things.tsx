import { FiveThingsReplay } from "@/components/landing/demos/five-things";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";

export function FiveThings() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">
            What you can drive on day one
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Your first five minutes.
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed">
            Click any one to replay the conversation.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <FiveThingsReplay />
        </Reveal>
      </div>
    </section>
  );
}
