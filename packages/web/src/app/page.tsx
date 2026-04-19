import Link from "next/link";
import { SiteNav } from "@/components/landing/site-nav";
import { HeroDemo } from "@/components/landing/hero-demo";
import { Reveal, Stagger, staggerItem } from "@/components/landing/reveal";
import { PiiTypewriter } from "@/components/landing/demos/pii-typewriter";
import { ZapVsForemanRace } from "@/components/landing/demos/zap-race";
import { ChannelMemory } from "@/components/landing/demos/channel-memory";
import { ToolDiscovery } from "@/components/landing/demos/tool-discovery";
import { HistorySearch } from "@/components/landing/demos/history-search";
import { GuardrailCards } from "@/components/landing/demos/guardrail-cards";
import { ByozOAuth } from "@/components/landing/demos/byoz-oauth";
import { WorkflowExtraction } from "@/components/landing/demos/workflow-extraction";
import { FiveThingsReplay } from "@/components/landing/demos/five-things";
import { HowItWorksScroll } from "@/components/landing/demos/how-it-works-scroll";
import { MagneticButton } from "@/components/landing/demos/magnetic-button";
import { TiltCard } from "@/components/landing/demos/tilt-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  Shield,
  MessageSquare,
  GitBranch,
  ArrowRight,
  Check,
  Server,
  Cloud,
  ExternalLink,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <main className="flex-1">
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

/* ─── Hero ─── */

function Hero() {
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
            Describe what you want done — it picks the app, drafts the action,
            waits for approval, and executes. In any chat app you already use.
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

/* ─── Why Not Zap (with live race) ─── */

function WhyNotZap() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">For existing Zapier users</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Why build a Zap for every little thing?
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Building a Zap is great for scheduled, recurring automations. It's
            overkill when you just need to send an email. Watch them race.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ZapVsForemanRace />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── How It Works (scroll progression) ─── */

function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-12 sm:mb-16">
          <Badge variant="accent" className="mb-4">How it works</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Three steps. No configuration.
          </h2>
        </Reveal>
        <HowItWorksScroll />
      </div>
    </section>
  );
}

/* ─── Tool Discovery section ─── */

function ToolDiscoverySection() {
  return (
    <section id="features" className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <div className="grid md:grid-cols-[1fr_1.3fr] gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Picks the right tool for the job</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Smart enough to know what to use.
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Foreman has a toolbox of ways to talk to your apps. Instead of
              picking through all of them every time, it reads what you asked
              and pulls out only the tools it actually needs. Faster responses,
              and nothing clutters the conversation.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Understands what you're asking, not just what you typed",
                "Grabs the handful of tools needed for your request",
                "Ignores the rest — no noise, faster replies",
                "Works across all 9,000+ Zapier apps",
              ].map((line) => (
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
            <ToolDiscovery />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Channels (with memory diagram) ─── */

function Channels() {
  return (
    <section id="channels" className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">One brain, everywhere</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Same memory across every channel.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Ask in Slack, follow up from Telegram, approve from your phone.
            Your apps, preferences, and action history travel with you.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 md:gap-10 items-start">
          <Reveal>
            <ChannelMemory />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {[
                { name: "Slack", avail: true },
                { name: "Discord", avail: true },
                { name: "Telegram", avail: true },
                { name: "Google Chat", avail: true },
                { name: "GitHub", avail: true },
                { name: "Linear", avail: true },
                { name: "Web", avail: true },
                { name: "MCP", avail: true },
                { name: "A2A", avail: true },
                { name: "Teams", avail: false },
                { name: "WhatsApp", avail: false },
                { name: "iMessage", avail: false },
              ].map((c) => (
                <div
                  key={c.name}
                  className={`rounded-lg border px-3 py-2.5 text-xs sm:text-sm transition-colors ${
                    c.avail
                      ? "border-border bg-surface hover:border-accent/40"
                      : "border-border/40 bg-surface/40 text-muted"
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  {!c.avail && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted">
                      soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Guardrails (interactive cards) ─── */

function Guardrails() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">Safe by construction</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            An AI with a leash.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Click a guardrail to see it in action. Agents that execute real
            actions need real limits — Foreman ships them by default.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <GuardrailCards />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Semantic history section ─── */

function HistorySection() {
  return (
    <section className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Semantic action history</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              "What did I send to Jake last week?"
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Every action Foreman runs gets indexed with embeddings. Ask a
              fuzzy question and get the exact email, card, or invoice back —
              plus a relevance score. No keywords required.
            </p>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <HistorySearch />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── PII typewriter section ─── */

function PiiSection() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">PII redaction, always on</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Sensitive data never reaches the model.
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              Emails, API keys, Bearer tokens, phone numbers, credit cards, and
              SSNs are stripped from every output before it touches your chat.
              Built into the processor pipeline — can't be turned off by accident.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Regex + entropy-based detection",
                "Runs on every agent output",
                "Zero config, no prompt required",
                "Works with voice responses too",
              ].map((line) => (
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
            <PiiTypewriter />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── BYOZ (OAuth demo) ─── */

function BringYourOwnZapier() {
  return (
    <section className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 lg:gap-16 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">Bring your own Zapier</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Your account. Your connections. Your usage.
            </h2>
            <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
              One-click OAuth to your existing Zapier account. Everything you've
              already connected — Gmail, Slack, Trello — is instantly available.
              Actions run against your Zapier tasks, billed by Zapier.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "No re-connecting apps",
                "No extra per-action fees",
                "Works alongside your existing Zaps",
                "Revoke access in one click",
              ].map((line) => (
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

/* ─── Workflows (extraction demo) ─── */

function Workflows() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">Workflows</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Do it once. Save the pattern.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            When a sequence repeats, Foreman extracts it as a reusable workflow
            — with streamed progress and run history. Built from the
            conversation, not a canvas.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <WorkflowExtraction />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Hosting (tilt cards) ─── */

function Hosting() {
  return (
    <section id="hosting" className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">Hosting</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Cloud or your own hardware.
          </h2>
        </Reveal>

        <Stagger className="grid md:grid-cols-2 gap-4 sm:gap-5" staggerDelay={0.12}>
          <Reveal>
            <TiltCard max={4}>
              <Card className="bg-background border-border/60 h-full flex flex-col">
                <CardContent className="p-6 sm:p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                        <Cloud className="h-5 w-5 text-muted" />
                      </div>
                      <h3 className="text-xl font-semibold">Cloud</h3>
                    </div>
                    <Badge variant="outline">Alpha</Badge>
                  </div>
                  <p className="text-sm text-muted mb-6 leading-relaxed">
                    Sign in with Clerk, connect your Zapier account, start
                    chatting. Zero infrastructure.
                  </p>
                  <ul className="space-y-2.5 text-sm mb-8 flex-1">
                    {["Managed upgrades and backups", "All 9 chat channels included", "Usage billed by Zapier"].map((line) => (
                      <li key={line} className="flex items-center gap-2.5">
                        <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href="/chat">Start free</Link>
                  </Button>
                </CardContent>
              </Card>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.1}>
            <TiltCard max={4}>
              <Card className="border-2 border-accent/20 bg-accent/[0.02] h-full flex flex-col relative overflow-hidden">
                <CardContent className="p-6 sm:p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Server className="h-5 w-5 text-accent" />
                      </div>
                      <h3 className="text-xl font-semibold">Self-host</h3>
                    </div>
                    <Badge variant="accent">MIT</Badge>
                  </div>
                  <p className="text-sm text-muted mb-6 leading-relaxed">
                    Run Foreman on your own VPS. Data never leaves your
                    infrastructure. One Docker container, SQLite, done.
                  </p>
                  <ul className="space-y-2.5 text-sm mb-8 flex-1">
                    {["MIT-licensed, no feature gates", "Docker or bare-metal", "Shared Zapier account for your team", "Clerk for auth (free tier works)"].map((line) => (
                      <li key={line} className="flex items-center gap-2.5">
                        <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                      View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </TiltCard>
          </Reveal>
        </Stagger>
      </div>
    </section>
  );
}

/* ─── Five Things (click-to-replay) ─── */

function FiveThings() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">Try these five things</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Your first five minutes.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Click any one to replay the conversation.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <FiveThingsReplay />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Closing CTA (magnetic button) ─── */

function ClosingCta() {
  return (
    <section className="py-16 sm:py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="relative rounded-2xl border border-border/60 overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-surface via-background to-accent/5" />
            <div aria-hidden className="absolute top-0 right-0 w-[50vw] max-w-[400px] h-[50vw] max-h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />

            <div className="relative p-8 sm:p-12 md:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] max-w-2xl mx-auto">
                Stop building Zaps for every little thing.
              </h2>
              <p className="text-muted mt-4 sm:mt-5 text-base sm:text-lg max-w-xl mx-auto">
                Connect your Zapier account and start giving Foreman
                instructions. It's alpha — free while we build.
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

/* ─── Footer ─── */

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent text-accent-foreground text-[10px] font-bold">
            F
          </span>
          <span className="font-semibold text-foreground">Foreman</span>
          <span className="text-xs">
            &copy; {new Date().getFullYear()} Otaku Solutions &middot; MIT
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2">
          <a href="mailto:tylan@otakusolutions.io" className="hover:text-foreground transition-colors">
            tylan@otakusolutions.io
          </a>
          <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
            GitHub
          </a>
          <Link href="/chat" className="hover:text-foreground transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
