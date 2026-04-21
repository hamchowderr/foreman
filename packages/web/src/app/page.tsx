import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/sections/hero";
import { WhyNotZap } from "@/components/landing/sections/why-not-zap";
import { HowItWorks } from "@/components/landing/sections/how-it-works";
import { ToolDiscoverySection } from "@/components/landing/sections/tool-discovery-section";
import { Channels } from "@/components/landing/sections/channels";
import { Guardrails } from "@/components/landing/sections/guardrails";
import { HistorySection } from "@/components/landing/sections/history-section";
import { PiiSection } from "@/components/landing/sections/pii-section";
import { BringYourOwnZapier } from "@/components/landing/sections/bring-your-own-zapier";
import { Workflows } from "@/components/landing/sections/workflows";
import { Hosting } from "@/components/landing/sections/hosting";
import { FiveThings } from "@/components/landing/sections/five-things";
import { ClosingCta } from "@/components/landing/sections/closing-cta";
import { SiteFooter } from "@/components/landing/sections/site-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <SiteNav />
      <main className="flex-1 min-w-0">
        <Hero />
        <WhyNotZap />
        <HowItWorks />
        <ToolDiscoverySection />
        <Channels />
        <Guardrails />
        <HistorySection />
        <PiiSection />
        <BringYourOwnZapier />
        <Workflows />
        <Hosting />
        <FiveThings />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
