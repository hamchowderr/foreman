import Link from "next/link";
import { SiteNav } from "@/components/landing/site-nav";
import { HeroDemo } from "@/components/landing/hero-demo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  Shield,
  Brain,
  MessageSquare,
  GitBranch,
  Search,
  ArrowRight,
  Check,
  Lock,
  Eye,
  Gauge,
  Users,
  Terminal,
  Server,
  Cloud,
  ExternalLink,
  Cpu,
} from "lucide-react";
import {
  SlackIcon,
  DiscordIcon,
  TelegramIcon,
  GithubIcon,
  GlobeIcon as HoverGlobeIcon,
  ShieldCheckIcon,
  BrainCircuitIcon,
  EyeIcon as HoverEyeIcon,
  LockIcon as HoverLockIcon,
  MessageCircleIcon,
  MailIcon,
  GaugeIcon as HoverGaugeIcon,
  UsersIcon as HoverUsersIcon,
  CpuIcon as HoverCpuIcon,
  SendIcon as HoverSendIcon,
  CloudIcon as HoverCloudIcon,
  TerminalIcon as HoverTerminalIcon,
} from "@/components/icons";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <LogoBar />
        <Features />
        <WhyNotZap />
        <HowItWorks />
        <Channels />
        <Guardrails />
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
      {/* Background effects */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/[0.03] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-20 sm:pt-28 pb-20 grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <Badge variant="accent" className="gap-1.5 py-1 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Built on your Zapier account
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.035em] leading-[1.08]">
            Skip the Zap.
            <br />
            <span className="text-accent">Just say it.</span>
          </h1>

          <p className="text-lg text-muted max-w-lg leading-relaxed">
            Foreman is the plain-language layer over your Zapier account.
            Describe what you want done — it picks the app, drafts the action,
            waits for approval, and executes. In any chat app you already use.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link href="/chat">
                Connect Zapier <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                Self-host on GitHub
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted pt-1">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" />
              9,000+ apps
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" />
              Approval-gated
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-accent" />
              Open source
            </span>
          </div>
        </div>

        <div className="relative">
          <HeroDemo />
          <div aria-hidden className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-accent/8 blur-3xl -z-10" />
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Bar ─── */

function LogoBar() {
  const tools = ["Slack", "Discord", "Telegram", "Google Chat", "GitHub", "Linear", "Teams", "WhatsApp", "iMessage", "MCP"];
  return (
    <section className="section-divider" />
  );
}

/* ─── Features ─── */

function Features() {
  const features = [
    {
      icon: Brain,
      title: "Dynamic tool discovery",
      description: "33 MCP tools from Zapier SDK. The agent searches and loads only the tools it needs per request — no token waste.",
    },
    {
      icon: Shield,
      title: "Human-in-the-loop",
      description: "Every write, delete, and API call requires explicit approval. You see exactly what will happen before it runs.",
    },
    {
      icon: MessageSquare,
      title: "Multi-channel memory",
      description: "Same agent, same memory across Slack, Discord, Telegram, web, and 6 more channels. Ask in one, follow up in another.",
    },
    {
      icon: Search,
      title: "Semantic action history",
      description: "RAG-powered recall of past actions. Ask 'what did I send to Jake last week?' and get instant results.",
    },
    {
      icon: Eye,
      title: "PII redaction, always on",
      description: "API keys, tokens, phone numbers, credit cards, SSNs — stripped from every response before it reaches you.",
    },
    {
      icon: GitBranch,
      title: "Conversation forking",
      description: "Branch a conversation to explore an alternative approach without losing the original thread.",
    },
  ];

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <Badge variant="accent" className="mb-4">Core capabilities</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Not another chatbot.
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            Foreman is an execution layer — it discovers what you can do, plans the action, and runs it after approval. Every feature exists to make that loop faster and safer.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="card-hover group bg-background border-border/60">
              <CardContent className="p-6">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-accent/10 text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-200">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Why Not Zap ─── */

function WhyNotZap() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">For existing Zapier users</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Why not just build a Zap?
          </h2>
          <p className="text-muted mt-4 text-lg">
            Because every one-off task shouldn't need a trigger, a filter, a path,
            and a round of testing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Card className="bg-background border-border/60">
            <CardContent className="p-7">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-muted" />
                </div>
                <h3 className="font-semibold">Building a Zap</h3>
              </div>
              <ol className="space-y-3 text-sm text-muted">
                {[
                  "Pick a trigger app",
                  "Map every field by hand",
                  "Add filters and paths",
                  "Test it, hit a schema mismatch, fix it",
                  "Publish, wait for it to silently break",
                ].map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-muted/40 font-mono text-xs mt-0.5 tabular-nums w-5">0{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-xs text-muted border-t border-border pt-4">
                Great for scheduled, recurring automations. Overkill for
                <em> "email Jake the deck."</em>
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-accent/20 bg-accent/[0.02] relative overflow-hidden">
            <div className="absolute -top-px left-6 bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-b-md">
              Foreman
            </div>
            <CardContent className="p-7 pt-10">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-accent-foreground" />
                </div>
                <h3 className="font-semibold">Just say it</h3>
              </div>
              <ol className="space-y-3 text-sm">
                {[
                  "Describe what you want",
                  "Review the draft",
                  "Approve. It runs.",
                ].map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-accent font-mono text-xs mt-0.5 font-semibold tabular-nums w-5">0{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-xs text-muted border-t border-accent/10 pt-4">
                No trigger to configure, no field mapping, nothing to maintain.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Say it in plain English",
      body: "In Slack, web, voice, or any channel. No app name, no action name, no syntax.",
      icon: MessageSquare,
    },
    {
      num: "02",
      title: "Review the draft",
      body: "Foreman picks the right app and action, fills every field, and shows you exactly what it's about to do.",
      icon: Eye,
    },
    {
      num: "03",
      title: "Approve and it runs",
      body: "One click. Audit trail in your action history. Save it as a workflow if you'll use it again.",
      icon: Check,
    },
  ];

  return (
    <section id="how" className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <Badge variant="accent" className="mb-4">How it works</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Three steps. No configuration.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <Card key={s.num} className="card-hover bg-background border-border/60 group">
              <CardContent className="p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-accent font-mono text-sm font-semibold">{s.num}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Channels ─── */

function Channels() {
  const channels: Array<{ name: string; desc: string; available: boolean; icon: React.ReactNode }> = [
    { name: "Web", desc: "Full chat UI with voice", available: true, icon: <HoverGlobeIcon size={18} /> },
    { name: "Slack", desc: "DM or @mention", available: true, icon: <SlackIcon size={18} /> },
    { name: "Discord", desc: "Gateway + slash commands", available: true, icon: <DiscordIcon size={18} /> },
    { name: "Telegram", desc: "Bot with inline approvals", available: true, icon: <TelegramIcon size={18} /> },
    { name: "Google Chat", desc: "Workspace-native", available: true, icon: <MessageCircleIcon size={18} /> },
    { name: "GitHub", desc: "On issues and PRs", available: true, icon: <GithubIcon size={18} /> },
    { name: "Linear", desc: "Triage and follow-ups", available: true, icon: <HoverSendIcon size={18} /> },
    { name: "Teams", desc: "Coming soon", available: false, icon: <MessageCircleIcon size={18} /> },
    { name: "WhatsApp", desc: "Coming soon", available: false, icon: <MessageCircleIcon size={18} /> },
    { name: "iMessage", desc: "Coming soon", available: false, icon: <MailIcon size={18} /> },
    { name: "MCP", desc: "Claude Code, ChatGPT", available: true, icon: <HoverTerminalIcon size={18} /> },
    { name: "A2A", desc: "Agent-to-agent", available: true, icon: <HoverCpuIcon size={18} /> },
  ];

  return (
    <section id="channels" className="bg-surface/50 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">One brain, everywhere</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Same memory across every channel.
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            Ask Foreman something in Slack, follow up from Telegram, approve from
            your phone. Your apps, preferences, and action history travel with you.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {channels.map((c) => (
            <div
              key={c.name}
              className={`group rounded-xl border px-4 py-4 transition-all duration-150 ${
                c.available
                  ? "border-border/60 bg-background hover:border-accent/30 hover:shadow-sm cursor-default"
                  : "border-border/30 bg-surface/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center text-foreground/70 group-hover:text-accent transition-colors">
                  {c.icon}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{c.name}</span>
                    {!c.available && (
                      <span className="text-[10px] text-muted bg-surface rounded px-1.5 py-0.5">soon</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{c.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Guardrails ─── */

function Guardrails() {
  const items = [
    { icon: Shield, title: "Every write needs approval", body: "Sending, creating, deleting — Foreman shows the draft and waits. Nothing happens behind your back." },
    { icon: Eye, title: "PII redaction, always on", body: "Emails, API keys, Bearer tokens, phone numbers, credit cards, SSNs are stripped from every output." },
    { icon: Lock, title: "Tokens encrypted at rest", body: "AES-256-GCM for Zapier OAuth tokens. SHA-256 hashed API keys. No plaintext secrets." },
    { icon: Shield, title: "Sensitive apps blocked", body: "Banking, HR, and security apps require explicit opt-in before Foreman will touch them." },
    { icon: Gauge, title: "Rate-limited per user", body: "30 actions/min, 200/hour. Bulk operations over 5 records get an extra confirmation." },
    { icon: Users, title: "Admin override for orgs", body: "Org admins set guardrail defaults for every member. Multi-tenant-safe from day one." },
  ];

  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">Safe by construction</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            An AI with a leash.
          </h2>
          <p className="text-muted mt-4 text-lg">
            Agents that execute real actions need real guardrails. Foreman ships them by default.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.title} className="card-hover bg-background border-border/60 group">
              <CardContent className="p-6">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/5 text-foreground/70 mb-4 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                  <item.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bring Your Own Zapier ─── */

function BringYourOwnZapier() {
  return (
    <section className="bg-surface/50 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <Badge variant="accent" className="mb-4">Bring your own Zapier</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Your account. Your connections. Your usage.
            </h2>
            <p className="text-muted mt-4 text-lg leading-relaxed">
              One-click OAuth to your existing Zapier account. Everything you've
              already connected — Gmail, Slack, Trello, whatever — is instantly
              available. Actions run against your Zapier tasks, billed by Zapier.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "No re-connecting apps",
                "No extra per-action fees",
                "Works alongside your existing Zaps",
                "Revoke access in one click",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-accent" />
                  </div>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="bg-background border-border/60 overflow-hidden">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted" />
                <span className="text-xs text-muted font-mono">setup</span>
              </div>
              <div className="p-6 font-mono text-sm space-y-5">
                <div>
                  <div className="text-xs text-muted mb-2"># One-time setup</div>
                  <div className="space-y-1">
                    <div><span className="text-muted">$</span> Sign in to Foreman</div>
                    <div><span className="text-muted">$</span> Click "Connect Zapier"</div>
                    <div><span className="text-muted">$</span> Authorize <span className="text-accent font-semibold">done</span></div>
                  </div>
                </div>
                <div className="border-t border-border/40 pt-5">
                  <div className="text-xs text-muted mb-2"># Then, forever</div>
                  <div className="space-y-1 text-muted">
                    <div><span className="text-foreground">&gt;</span> "Send Jake the deck"</div>
                    <div><span className="text-foreground">&gt;</span> "Create a Trello card for follow-up"</div>
                    <div><span className="text-foreground">&gt;</span> "Search invoices in Gmail"</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ─── Workflows ─── */

function Workflows() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">Workflows</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Do it once. Save the pattern.
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            When you run the same sequence more than once, Foreman can extract
            it as a reusable workflow — with step-by-step progress and run history.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { title: "Extracted from chat", body: "Highlight a sequence, save as workflow. No separate builder.", icon: MessageSquare },
            { title: "Streamed runs", body: "Watch each step complete in real time via SSE.", icon: Zap },
            { title: "Run history", body: "Every execution logged with status. Re-run or fork anytime.", icon: GitBranch },
          ].map((f) => (
            <Card key={f.title} className="card-hover bg-background border-border/60 group">
              <CardContent className="p-6">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-accent/10 text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Hosting ─── */

function Hosting() {
  return (
    <section id="hosting" className="bg-surface/50 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">Hosting</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Cloud or your own hardware.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Card className="bg-background border-border/60 flex flex-col">
            <CardContent className="p-8 flex flex-col flex-1">
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
                Sign in with Clerk, connect your Zapier account, start chatting. Zero infrastructure.
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

          <Card className="border-2 border-accent/20 bg-accent/[0.02] flex flex-col relative overflow-hidden">
            <div className="absolute -top-px left-8 bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-b-md">
              Recommended
            </div>
            <CardContent className="p-8 pt-10 flex flex-col flex-1">
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
                Run Foreman on your own VPS. Data never leaves your infrastructure.
                One Docker container, SQLite, done.
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
        </div>
      </div>
    </section>
  );
}

/* ─── Five Things ─── */

function FiveThings() {
  const rows = [
    { say: "What apps do I have connected?", does: "Lists your connected Zapier apps (Gmail, Slack, Trello, ...)" },
    { say: "Email test@example.com that the project is complete", does: "Finds Gmail's send action, shows the draft, sends on approval" },
    { say: "Create a Trello card 'Follow up with client' in my To Do list", does: "Discovers Trello actions, picks board/list, creates after approval" },
    { say: "What actions can I do with Slack?", does: "Lists every available Slack action across your connection" },
    { say: "Search my recent emails for anything about invoices", does: "Runs Gmail search and returns matching threads" },
  ];

  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <Badge variant="accent" className="mb-4">Try these five things</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Your first five minutes.
          </h2>
        </div>

        <Card className="bg-background border-border/60 overflow-hidden">
          <div className="grid grid-cols-[1fr_1.3fr] text-[11px] uppercase tracking-widest text-muted font-medium border-b border-border/60">
            <div className="px-6 py-3.5">You say</div>
            <div className="px-6 py-3.5 border-l border-border/60">Foreman does</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-[1fr_1.3fr] text-sm group hover:bg-surface/50 transition-colors ${
                i < rows.length - 1 ? "border-b border-border/40" : ""
              }`}
            >
              <div className="px-6 py-4 font-mono text-xs sm:text-sm text-foreground/80">
                "{r.say}"
              </div>
              <div className="px-6 py-4 text-muted border-l border-border/40 group-hover:text-foreground/70 transition-colors">
                {r.does}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </section>
  );
}

/* ─── Closing CTA ─── */

function ClosingCta() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative rounded-2xl border border-border/60 overflow-hidden">
          {/* Background effect */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-surface via-background to-accent/5" />
          <div aria-hidden className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />

          <div className="relative p-10 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.03em] max-w-2xl mx-auto">
              Stop building Zaps for every little thing.
            </h2>
            <p className="text-muted mt-5 text-lg max-w-xl mx-auto">
              Connect your Zapier account and start giving Foreman instructions.
              It's alpha — free while we build.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Button size="lg" variant="accent" asChild>
                <Link href="/chat">
                  Connect Zapier <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer">
                  Self-host
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent text-accent-foreground text-[10px] font-bold">
            F
          </span>
          <span className="font-semibold text-foreground">Foreman</span>
          <span className="text-xs ml-1">
            &copy; {new Date().getFullYear()} Otaku Solutions &middot; MIT
          </span>
        </div>
        <div className="flex items-center gap-5">
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
