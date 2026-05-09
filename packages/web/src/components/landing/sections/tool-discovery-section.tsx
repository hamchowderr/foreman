import { Reveal } from "@/components/landing/reveal";
import { ToolDiscovery } from "@/components/landing/demos/tool-discovery";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";
import { Check } from "@/components/icons/hi";

const BULLETS = [
  "Execute actions, search data, manage tables",
  "Discover and connect apps on the fly",
  "Authenticated HTTP requests via Zapier Relay",
  "Works across all 9,000+ Zapier apps",
];

export function ToolDiscoverySection() {
  return (
    <section id="features" className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <div className="grid md:grid-cols-[1fr_1.3fr] gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Drives your whole Zapier account</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Every action. Every table. Every message.
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Actions, Zapier Tables, authenticated HTTP, connection discovery — 33 SDK tools in all. Foreman searches and loads only what a request needs, so it stays fast across 9,000+ apps.
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
              <ToolDiscovery />
            </TiltedSpotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
