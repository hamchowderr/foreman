import { Check } from "@/components/icons/hi";
import { PiiTypewriter } from "@/components/landing/demos/pii-typewriter";
import { Reveal } from "@/components/landing/reveal";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";

const BULLETS = [
  "Catches emails, phone numbers, cards, SSNs, API keys",
  "Runs on every reply Foreman sends you",
  "Works across chat, voice, and webhook responses",
  "On by default. Nothing to configure.",
];

export function PiiSection() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">
              Sensitive info stays out of sight
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Personal details get hidden before you see them.
            </h2>
            <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed">
              When Foreman pulls data back from your apps, it scans the answer for anything
              sensitive — email addresses, phone numbers, card numbers, API keys — and blanks them
              out. You still get the answer. You just don't get the raw data spilled into your chat.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {BULLETS.map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-accent" />
                  </div>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <TiltedSpotlight>
              <PiiTypewriter />
            </TiltedSpotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
