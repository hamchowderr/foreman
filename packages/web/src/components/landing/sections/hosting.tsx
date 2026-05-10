import Link from "next/link";
import { ArrowRight, Check, Cloud, ExternalLink, Server } from "@/components/icons/hi";
import { Reveal } from "@/components/landing/reveal";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CLOUD_BULLETS = [
  "Managed upgrades, backups, and monitoring",
  "All 9 chat channels + MCP + A2A included",
  "Multi-tenant — connect your account or your clients'",
  "Zapier usage billed by Zapier, not us",
];

export function Hosting() {
  return (
    <section id="hosting" className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Cloud — primary */}
        <Reveal className="max-w-3xl mx-auto text-center mb-10">
          <Badge variant="accent" className="mb-4">
            Two ways to run it
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Alpha-hosted or on your own server.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            Use our alpha to try it free. Self-host when you&apos;re ready to run it for your team
            or your clients — one Docker container, your data stays yours, full source on GitHub.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="max-w-2xl mx-auto">
          <TiltedSpotlight>
            <Card className="bg-background border-border/60">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Foreman Cloud</h3>
                      <p className="text-xs text-muted">Free during alpha</p>
                    </div>
                  </div>
                  <Badge variant="outline">Alpha</Badge>
                </div>
                <ul className="space-y-2.5 text-sm mb-6">
                  {CLOUD_BULLETS.map((line) => (
                    <li key={line} className="flex items-center gap-2.5">
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="accent" asChild className="w-full">
                  <Link href="/chat">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TiltedSpotlight>
        </Reveal>

        {/* Self-host — secondary, separated */}
        <Reveal delay={0.2} className="max-w-2xl mx-auto mt-12">
          <TiltedSpotlight radius="rounded-xl" maxTilt={2}>
            <div className="rounded-xl border border-border/40 bg-surface/30 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                    <Server className="h-4 w-4 text-muted" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Self-host</h3>
                      <Badge variant="accent" className="text-[10px]">
                        MIT
                      </Badge>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      One Docker container. Your server, your data. Full source on GitHub.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                    View on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <div className="mt-4 rounded-lg bg-background border border-border/40 p-3 font-mono text-xs text-muted overflow-x-auto">
                <span className="text-accent">$</span> docker run -p 4111:4111 foreman
              </div>
            </div>
          </TiltedSpotlight>
        </Reveal>
      </div>
    </section>
  );
}
