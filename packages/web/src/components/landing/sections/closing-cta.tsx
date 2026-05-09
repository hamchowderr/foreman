import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { MagneticButton } from "@/components/landing/demos/magnetic-button";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/components/icons/hi";

export function ClosingCta() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="relative rounded-2xl border border-border/60 overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-surface via-background to-accent/5" />
            <div aria-hidden className="absolute top-0 right-0 w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />

            <div className="relative p-8 sm:p-12 md:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] max-w-2xl mx-auto">
                You already built the connections. Start driving them.
              </h2>
              <p className="text-muted mt-4 sm:mt-5 text-base sm:text-lg max-w-xl mx-auto">
                Connect your Zapier account once. Then talk to it from any chat
                app you already use. Approval-gated, audit-logged, open source.
                Free while we&apos;re in alpha.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-6 sm:mt-8">
                <MagneticButton strength={0.25}>
                  <Button size="lg" variant="accent" asChild>
                    <Link href="/chat">
                      Connect Zapier <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </MagneticButton>
                <Button size="lg" variant="outline" asChild>
                  <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                    Self-host
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
