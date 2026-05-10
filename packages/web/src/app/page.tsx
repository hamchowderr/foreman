import { Channels } from "@/components/landing/sections/channels";
import { ClosingCta } from "@/components/landing/sections/closing-cta";
import { FiveThings } from "@/components/landing/sections/five-things";
import { Guardrails } from "@/components/landing/sections/guardrails";
import { Hero } from "@/components/landing/sections/hero";
import { HistorySection } from "@/components/landing/sections/history-section";
import { Hosting } from "@/components/landing/sections/hosting";
import { HowItWorks } from "@/components/landing/sections/how-it-works";
import { PiiSection } from "@/components/landing/sections/pii-section";
import { ReasoningTrace } from "@/components/landing/sections/reasoning-trace";
import { SiteFooter } from "@/components/landing/sections/site-footer";
import { ToolDiscoverySection } from "@/components/landing/sections/tool-discovery-section";
import { WhyNotZap } from "@/components/landing/sections/why-not-zap";
import { Workflows } from "@/components/landing/sections/workflows";
import { SiteNav } from "@/components/landing/site-nav";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <SiteNav />
      <main className="flex-1 min-w-0">
        <Hero />
        <WhyNotZap />
        <HowItWorks />
        <ReasoningTrace />
        <ToolDiscoverySection />
        <Channels />
        <Guardrails />
        <HistorySection />
        <PiiSection />
        <Workflows />
        <Hosting />
        <FiveThings />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
