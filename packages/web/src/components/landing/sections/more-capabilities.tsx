import { Gauge, Lock, Users } from "@/components/icons/hi";
import { Reveal } from "@/components/landing/reveal";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";

export function MoreCapabilities() {
  return (
    <section className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <Badge variant="accent" className="mb-4">
            More in Foreman
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-balance">
            Beyond the chat driver.
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed text-pretty">
            Build live apps — dashboards, internal tools — from the data you pull, and run a
            separate workspace for every team or client, all from the same chat.
          </p>
        </Reveal>

        {/* Live dashboards — text left, visual right */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <Reveal>
            <Badge variant="accent" className="mb-4">
              Live apps
            </Badge>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-balance">
              Ask for an app. Get a live one.
            </h3>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
              Foreman pulls the numbers from your connected apps and turns them into a shareable app
              — a live dashboard or internal tool — you can bring up right from chat. KPIs, trends,
              and totals, refreshed whenever you ask. Just say what you want to see.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Built from the apps you already connected",
                "Pull it up from any channel by asking",
                "Share a snapshot with your team in one link",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} direction="right">
            <TiltedSpotlight>
              <DashboardMini />
            </TiltedSpotlight>
          </Reveal>
        </div>

        {/* Workspaces — visual left, text right (text first in source for mobile reading) */}
        <div className="mt-16 grid md:grid-cols-2 gap-10 md:gap-12 items-center sm:mt-20 md:mt-24">
          <Reveal className="md:order-2">
            <Badge variant="accent" className="mb-4">
              Workspaces
            </Badge>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-balance">
              One agent. A workspace per team or client.
            </h3>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
              Multi-tenant by design. Share one Zapier connection across a workspace, keep every
              person&apos;s chats private, and spin up a separate, isolated workspace for each
              client — switch between them without leaving chat.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Isolated data and members per workspace",
                "Shared connections, private conversations",
                "A clean tenant for every client you serve",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="md:order-1">
            <TiltedSpotlight>
              <WorkspaceMini />
            </TiltedSpotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const KPIS = [
  { label: "MRR", value: "$48.2k", delta: "+12%" },
  { label: "New customers", value: "37", delta: "+8" },
  { label: "Open deals", value: "14", delta: "+3" },
];

const BARS = [
  { id: "mon", h: "h-[38%]" },
  { id: "tue", h: "h-[54%]" },
  { id: "wed", h: "h-[44%]" },
  { id: "thu", h: "h-[66%]" },
  { id: "fri", h: "h-[58%]" },
  { id: "sat", h: "h-[82%]" },
  { id: "sun", h: "h-[72%]" },
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function DashboardMini() {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" />
          <span className="text-xs font-medium">Revenue · this week</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> live
        </span>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          {KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border/60 bg-background/40 p-3"
            >
              <div className="text-[11px] text-muted-foreground truncate">{kpi.label}</div>
              <div className="mt-1 text-base sm:text-lg font-semibold tabular-nums">
                {kpi.value}
              </div>
              <div className="text-[11px] font-medium text-green-600 dark:text-green-400 tabular-nums">
                {kpi.delta}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-end gap-1.5 h-24">
            {BARS.map((bar, i) => (
              <div
                key={bar.id}
                className={`flex-1 rounded-t ${i >= 5 ? "bg-accent" : "bg-accent/30"} ${bar.h}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between px-0.5 text-[10px] text-muted-foreground">
            {BARS.map((bar, i) => (
              <span key={bar.id} className="w-3 text-center">
                {DAY_LABELS[i]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const WORKSPACES = [
  {
    initials: "A",
    name: "Acme Corp",
    type: "Team workspace",
    members: 5,
    chipClass: "bg-accent text-white",
    active: true,
  },
  {
    initials: "B",
    name: "Beta Client",
    type: "Client workspace",
    members: 2,
    chipClass: "bg-blue-500 text-white",
    active: false,
  },
  {
    initials: "P",
    name: "Personal",
    type: "Just you",
    members: 1,
    chipClass: "bg-purple-500 text-white",
    active: false,
  },
];

const AVATAR_COLORS = ["bg-accent", "bg-blue-500", "bg-purple-500", "bg-emerald-500"];

function MemberDots({ count }: { count: number }) {
  const shown = AVATAR_COLORS.slice(0, Math.min(count, 3));
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((color) => (
        <span key={color} className={`h-5 w-5 rounded-full ring-2 ring-surface ${color}`} />
      ))}
      {count > shown.length && (
        <span className="ml-2.5 text-[11px] text-muted-foreground">+{count - shown.length}</span>
      )}
    </div>
  );
}

function WorkspaceMini() {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Users className="h-4 w-4 text-accent" />
        <span className="text-xs font-medium">Workspaces</span>
      </div>
      <div className="p-3 sm:p-4 space-y-2">
        {WORKSPACES.map((ws) => (
          <div
            key={ws.name}
            className={`rounded-xl border p-3 ${
              ws.active ? "border-accent/40 bg-accent/5" : "border-border/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${ws.chipClass}`}
                >
                  {ws.initials}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{ws.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{ws.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <MemberDots count={ws.members} />
                {ws.active && (
                  <span className="text-[10px] uppercase tracking-wider text-accent font-medium">
                    active
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" />
        One Zapier connection shared · each person&apos;s chats stay private
      </div>
    </div>
  );
}
