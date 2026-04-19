import Link from "next/link";
import { SiteNav } from "@/components/landing/site-nav";
import { HeroDemo } from "@/components/landing/hero-demo";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Logos />
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

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,74,0,0.08),transparent_60%)]"
      />
      <div className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Built on your Zapier account
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
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
            <Link
              href="/chat"
              className="rounded-md bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Connect Zapier →
            </Link>
            <a
              href="https://github.com/hamchowderr/foreman"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface"
            >
              Self-host on GitHub
            </a>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted pt-2">
            <span>⚡ 9,000+ apps</span>
            <span>✓ Approval-gated</span>
            <span>◊ Open source</span>
          </div>
        </div>
        <div className="relative">
          <HeroDemo />
          <div
            aria-hidden
            className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-accent/10 blur-3xl -z-10"
          />
        </div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-center text-xs uppercase tracking-widest text-muted mb-5">
          Works across the tools you already live in
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          <span>Slack</span>
          <span>·</span>
          <span>Discord</span>
          <span>·</span>
          <span>Telegram</span>
          <span>·</span>
          <span>Google Chat</span>
          <span>·</span>
          <span>GitHub</span>
          <span>·</span>
          <span>Linear</span>
          <span>·</span>
          <span>Teams</span>
          <span>·</span>
          <span>WhatsApp</span>
          <span>·</span>
          <span>iMessage</span>
          <span>·</span>
          <span>MCP</span>
        </div>
      </div>
    </section>
  );
}

function WhyNotZap() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <div className="max-w-2xl mb-12">
        <p className="text-sm text-accent font-medium mb-3">
          For existing Zapier users
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Why not just build a Zap?
        </h2>
        <p className="text-muted mt-4 text-lg">
          Because every one-off task shouldn't need a trigger, a filter, a path,
          and a round of testing. For anything that isn't a scheduled recurring
          workflow, Foreman is faster.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-foreground/5 text-xs font-semibold">
              ⚡
            </span>
            <h3 className="font-semibold">Building a Zap</h3>
          </div>
          <ol className="space-y-2.5 text-sm text-muted">
            {[
              "Pick a trigger app",
              "Map every field by hand",
              "Add filters and paths",
              "Test it, hit a schema mismatch, fix it",
              "Publish, wait for it to silently break",
            ].map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-muted/60 tabular-nums">
                  0{i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-muted border-t border-border pt-4">
            Great for scheduled, recurring automations. Overkill for
            <em> &ldquo;email Jake the deck.&rdquo;</em>
          </p>
        </div>
        <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-6 relative">
          <div className="absolute -top-3 left-6 bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            Foreman
          </div>
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-accent text-accent-foreground text-xs font-semibold">
              F
            </span>
            <h3 className="font-semibold">Just say it</h3>
          </div>
          <ol className="space-y-2.5 text-sm">
            <li className="flex gap-3">
              <span className="text-accent tabular-nums font-semibold">01</span>
              <span>Describe what you want</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent tabular-nums font-semibold">02</span>
              <span>Review the draft</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent tabular-nums font-semibold">03</span>
              <span>Approve. It runs.</span>
            </li>
          </ol>
          <p className="mt-5 text-xs text-muted border-t border-accent/20 pt-4">
            No trigger to configure, no field mapping, nothing to maintain.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Say it in plain English",
      body: "In Slack, web, voice, or any channel. No app name, no action name, no syntax.",
    },
    {
      num: "02",
      title: "Review the draft",
      body: "Foreman picks the right app and action, fills every field, and shows you exactly what it's about to do.",
    },
    {
      num: "03",
      title: "Approve and it runs",
      body: "One click. Audit trail in your action history. Save it as a workflow if you'll use it again.",
    },
  ];
  return (
    <section
      id="how"
      className="border-t border-border bg-surface"
    >
      <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
        <div className="max-w-2xl mb-14">
          <p className="text-sm text-accent font-medium mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Three steps. No configuration.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className="rounded-xl bg-background border border-border p-6"
            >
              <div className="text-accent font-mono text-sm mb-4">{s.num}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Channels() {
  const channels = [
    { name: "Web", desc: "Full chat UI with voice" },
    { name: "Slack", desc: "DM or @mention" },
    { name: "Discord", desc: "Gateway + slash commands" },
    { name: "Telegram", desc: "Bot with inline approvals" },
    { name: "Google Chat", desc: "Workspace-native" },
    { name: "GitHub", desc: "On issues and PRs" },
    { name: "Linear", desc: "Triage and follow-ups" },
    { name: "Teams", desc: "Coming soon" },
    { name: "WhatsApp", desc: "Coming soon" },
    { name: "iMessage", desc: "Coming soon" },
    { name: "MCP", desc: "Claude Code, ChatGPT" },
    { name: "A2A", desc: "Other agents" },
  ];
  return (
    <section id="channels" className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <div className="max-w-2xl mb-12">
        <p className="text-sm text-accent font-medium mb-3">One brain, everywhere</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Same memory across every channel.
        </h2>
        <p className="text-muted mt-4 text-lg">
          Ask Foreman something in Slack, follow up from Telegram, approve from
          your phone. Your apps, preferences, and action history travel with
          you.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {channels.map((c) => (
          <div
            key={c.name}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="font-medium text-sm">{c.name}</div>
            <div className="text-xs text-muted mt-0.5">{c.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Guardrails() {
  const items = [
    {
      title: "Every write needs approval",
      body: "Sending, creating, deleting — Foreman shows the draft and waits. Nothing happens behind your back.",
    },
    {
      title: "PII redaction, always on",
      body: "Emails, API keys, Bearer tokens, phone numbers, credit cards, SSNs are stripped from every output.",
    },
    {
      title: "Tokens encrypted at rest",
      body: "AES-256-GCM for Zapier OAuth tokens. SHA-256 hashed API keys. No plaintext secrets.",
    },
    {
      title: "Sensitive apps blocked by default",
      body: "Banking, HR, and security apps require explicit opt-in before Foreman will touch them.",
    },
    {
      title: "Rate-limited per user",
      body: "30 actions/min, 200/hour. Bulk operations over 5 records get an extra confirmation.",
    },
    {
      title: "Admin override for orgs",
      body: "Org admins set guardrail defaults for every member. Multi-tenant-safe from day one.",
    },
  ];
  return (
    <section className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
        <div className="max-w-2xl mb-14">
          <p className="text-sm text-accent font-medium mb-3">
            Safe by construction
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            An AI with a leash.
          </h2>
          <p className="text-muted mt-4 text-lg">
            Agents that execute real actions need real guardrails. Foreman ships
            them by default.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((i) => (
            <div
              key={i.title}
              className="rounded-xl border border-border bg-background p-5"
            >
              <h3 className="font-semibold text-sm mb-2">{i.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{i.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BringYourOwnZapier() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm text-accent font-medium mb-3">
            Bring your own Zapier
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Your account. Your connections. Your usage.
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            One-click OAuth to your existing Zapier account. Everything you've
            already connected — Gmail, Slack, Trello, whatever — is instantly
            available. Actions run against your Zapier tasks, billed by Zapier.
            Cancel anytime and your Zaps are untouched.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              "No re-connecting apps",
              "No extra per-action fees",
              "Works alongside your existing Zaps",
              "Revoke access in one click",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className="text-accent">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 font-mono text-xs">
          <div className="text-muted mb-3"># One-time setup</div>
          <div className="space-y-1.5">
            <div>
              <span className="text-muted">$</span> Sign in to Foreman
            </div>
            <div>
              <span className="text-muted">$</span> Click &ldquo;Connect Zapier&rdquo;
            </div>
            <div>
              <span className="text-muted">$</span> Authorize →{" "}
              <span className="text-accent">done</span>
            </div>
          </div>
          <div className="text-muted mt-6 mb-3"># Then, forever</div>
          <div className="space-y-1.5">
            <div>&gt; &ldquo;Send Jake the deck&rdquo;</div>
            <div>&gt; &ldquo;Create a Trello card for client follow-up&rdquo;</div>
            <div>&gt; &ldquo;Search invoices in Gmail&rdquo;</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflows() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-sm text-accent font-medium mb-3">
            Workflows (for the recurring stuff)
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Do it once. Save the pattern.
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            When you run the same sequence more than once, Foreman can extract
            it as a reusable workflow — with step-by-step progress and run
            history. It's the closest thing to a Zap, built from the
            conversation instead of a canvas.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Feature
            title="Extracted from chat"
            body="Highlight a sequence, save as workflow. No separate builder."
          />
          <Feature
            title="Streamed runs"
            body="Watch each step complete in real time via SSE."
          />
          <Feature
            title="Run history"
            body="Every execution logged with status. Re-run or fork anytime."
          />
        </div>
      </div>
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-background border border-border p-5">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Hosting() {
  return (
    <section id="hosting" className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <div className="max-w-2xl mb-12">
        <p className="text-sm text-accent font-medium mb-3">Hosting</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Cloud or your own hardware.
        </h2>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-surface p-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Cloud</h3>
            <span className="text-xs font-medium text-muted border border-border rounded-full px-2 py-0.5">
              Alpha
            </span>
          </div>
          <p className="text-sm text-muted mb-5 leading-relaxed">
            Sign in with Clerk, connect your Zapier account, start chatting.
            Zero infrastructure.
          </p>
          <ul className="space-y-2 text-sm mb-6 flex-1">
            {[
              "Managed upgrades and backups",
              "All 9 chat channels included",
              "Usage billed by Zapier",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className="text-accent">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/chat"
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium text-center hover:opacity-90"
          >
            Start free
          </Link>
        </div>
        <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Self-host</h3>
            <span className="text-xs font-medium text-accent border border-accent/30 rounded-full px-2 py-0.5">
              MIT
            </span>
          </div>
          <p className="text-sm text-muted mb-5 leading-relaxed">
            Run Foreman on your own VPS. Data never leaves your infrastructure.
            One Docker container, SQLite, done.
          </p>
          <ul className="space-y-2 text-sm mb-6 flex-1">
            {[
              "MIT-licensed, no feature gates",
              "Docker or bare-metal",
              "Shared Zapier account for your team",
              "Clerk for auth (free tier works)",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className="text-accent">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/hamchowderr/foreman"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-center hover:bg-background"
          >
            View on GitHub →
          </a>
        </div>
      </div>
    </section>
  );
}

function FiveThings() {
  const rows = [
    {
      say: "What apps do I have connected?",
      does: "Lists your connected Zapier apps (Gmail, Slack, Trello, …)",
    },
    {
      say: "Email test@example.com that the project is complete",
      does: "Finds Gmail's send action, shows the draft, sends on approval",
    },
    {
      say: "Create a Trello card 'Follow up with client' in my To Do list",
      does: "Discovers Trello actions, picks board/list, creates after approval",
    },
    {
      say: "What actions can I do with Slack?",
      does: "Lists every available Slack action across your connection",
    },
    {
      say: "Search my recent emails for anything about invoices",
      does: "Runs Gmail search and returns matching threads",
    },
  ];
  return (
    <section className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-sm text-accent font-medium mb-3">
            Try these five things
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Your first five minutes.
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="grid grid-cols-[1fr_1.3fr] text-xs uppercase tracking-wider text-muted border-b border-border">
            <div className="px-5 py-3">You say</div>
            <div className="px-5 py-3 border-l border-border">
              Foreman does
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-[1fr_1.3fr] text-sm ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="px-5 py-4 font-mono text-xs sm:text-sm">
                &ldquo;{r.say}&rdquo;
              </div>
              <div className="px-5 py-4 text-muted border-l border-border">
                {r.does}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-accent/5 p-10 sm:p-16 text-center">
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight max-w-2xl mx-auto">
          Stop building Zaps for every little thing.
        </h2>
        <p className="text-muted mt-4 text-lg max-w-xl mx-auto">
          Connect your Zapier account and start giving Foreman instructions.
          It's alpha — free while we build.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link
            href="/chat"
            className="rounded-md bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
          >
            Connect Zapier →
          </Link>
          <a
            href="https://github.com/hamchowderr/foreman"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-surface"
          >
            Self-host
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-sm bg-accent" />
          <span className="font-semibold text-foreground">Foreman</span>
          <span className="text-xs ml-1">
            © {new Date().getFullYear()} Otaku Solutions · MIT
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="mailto:tylan@otakusolutions.io"
            className="hover:text-foreground"
          >
            tylan@otakusolutions.io
          </a>
          <a
            href="https://github.com/hamchowderr/foreman"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <Link href="/chat" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
