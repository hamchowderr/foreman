import { AutomationsDemo } from "@/components/landing/demos/automations-demo";
import { Reveal } from "@/components/landing/reveal";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";

export function Automations() {
  return (
    <section id="automations" className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">
              Durable automations
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-balance">
              Build automations by chatting. Watch them run.
            </h2>
            <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed text-pretty">
              Describe what you want in plain English — Foreman drafts a durable automation, you
              approve it, and it runs on a durable engine that survives restarts and retries on its
              own. No flowchart builder, no canvas.
            </p>
            <p className="text-muted-foreground mt-3 text-base sm:text-lg leading-relaxed text-pretty">
              Every run is tracked end to end: <span className="text-foreground">started</span> →{" "}
              <span className="text-foreground">finished</span> or{" "}
              <span className="text-foreground">failed</span>, with the output and errors right
              there — updating live as they complete.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Authored from chat — no separate builder",
                "Approval-gated before anything runs",
                "Durable execution: retries, waits, and resumes",
                "Live run history with output + error detail",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <TiltedSpotlight>
              <AutomationsDemo />
            </TiltedSpotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
