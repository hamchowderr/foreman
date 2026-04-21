import { Reveal } from "@/components/landing/reveal";
import { ByozOAuth } from "@/components/landing/demos/byoz-oauth";
import { Badge } from "@/components/ui/badge";
import { Check } from "@/components/icons/hi";

const BULLETS = [
  "One click to connect — yours or your clients' accounts",
  "Existing apps, connections, and tables — all available",
  "Create tables, add fields, query records via chat",
  "Works alongside existing Zaps and workflows",
];

export function BringYourOwnZapier() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 lg:gap-16 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Your Zapier account, your rules</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Your account. Your clients. Your data.
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Connect your Zapier account once — or your clients' accounts
              in multi-tenant mode. Every app, connection, and Zapier Table
              is immediately available. Execute actions, manage tables,
              discover new integrations. Nothing new to install.
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
            <ByozOAuth />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
