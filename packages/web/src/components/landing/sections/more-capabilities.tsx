import { Gauge, Phone, Users } from "@/components/icons/hi";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";

const ITEMS = [
  {
    icon: Gauge,
    title: "Live dashboards",
    body: "Foreman snapshots data from your connected apps and turns it into shareable dashboards you can pull up from chat — no BI tool to wire.",
  },
  {
    icon: Users,
    title: "Workspaces for teams & clients",
    body: "Multi-tenant by design. Share one Zapier connection across a workspace, keep each person's chats private, or run a separate workspace per client.",
  },
  {
    icon: Phone,
    title: "Talk to it",
    body: "Voice in and out — speak a request, hear the result back. Whisper for speech-to-text, ElevenLabs or OpenAI for the reply.",
  },
];

export function MoreCapabilities() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
          <Badge variant="accent" className="mb-4">
            More in Foreman
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-balance">
            Beyond the chat driver.
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed text-pretty">
            Dashboards, multi-tenant workspaces, and voice — the rest of what ships in the box.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-border/60 bg-surface/40 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
