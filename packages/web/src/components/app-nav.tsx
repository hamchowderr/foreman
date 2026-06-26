import Link from "next/link";

/**
 * Shared top navigation for the authed app sections (Automations, Inbox,
 * Dashboards — and a link back to Chat). Server component: pass `active`
 * explicitly so it needs no client bundle. The Zapier mark matches the chat
 * sidebar + the rest of the app.
 */

type Section = "chat" | "automations" | "inbox" | "dashboards";

const SECTIONS: Array<{ key: Section; label: string; href: string }> = [
  { key: "chat", label: "Chat", href: "/chat" },
  { key: "automations", label: "Automations", href: "/automations" },
  { key: "inbox", label: "Inbox", href: "/inbox" },
  { key: "dashboards", label: "Dashboards", href: "/dashboards" },
];

export function AppNav({ active }: { active?: Section }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/chat" className="mr-2 flex shrink-0 items-center gap-2.5">
          {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
          <img
            alt="Foreman"
            className="size-6 object-contain"
            height={24}
            src="/zapier.svg"
            width={24}
          />
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
            Foreman
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-surface font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
