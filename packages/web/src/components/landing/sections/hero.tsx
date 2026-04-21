import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { HeroDemo } from "@/components/landing/hero-demo";
import { MagneticButton } from "@/components/landing/demos/magnetic-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, GitBranch, ArrowRight } from "@/components/icons/hi";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[800px] h-[60vh] max-h-[600px] bg-accent/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[40vw] max-w-[400px] h-[40vh] max-h-[400px] bg-accent/[0.03] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 md:pt-28 pb-12 sm:pb-20 grid md:grid-cols-2 gap-10 md:gap-12 lg:gap-16 items-center">
        <Reveal className="space-y-6 sm:space-y-8" direction="up">
          <Badge variant="accent" className="gap-1.5 py-1 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Built on your Zapier account
          </Badge>

          <h1 className="text-[2.25rem] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.035em] leading-[1.08]">
            Skip the Zap.
            <br />
            <span className="text-accent">Just say it.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted max-w-lg leading-relaxed">
            Foreman is the plain-language layer over your Zapier account.
            Execute actions, manage Zapier Tables, discover connections —
            all through natural language, with approval before anything runs.
            From any chat app you already use.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <MagneticButton strength={0.2}>
              <Button size="lg" variant="accent" asChild>
                <Link href="/chat">
                  Connect Zapier <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </MagneticButton>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                Self-host on GitHub
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted pt-1">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" /> 9,000+ apps
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" /> Approval-gated
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-accent" /> Open source
            </span>
          </div>
        </Reveal>

        <Reveal direction="up" delay={0.15} className="relative">
          <HeroDemo />
          <div aria-hidden className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-accent/[0.08] blur-3xl -z-10" />
        </Reveal>
      </div>
    </section>
  );
}
