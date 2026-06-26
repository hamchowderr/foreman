"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "API Keys", href: "/settings/integrations/mcp" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Only the single most-specific matching nav item is active (longest matching
  // href), so a sub-route like /settings/integrations/mcp doesn't also light up
  // its parent /settings/integrations.
  const activeHref =
    NAV.map((n) => n.href)
      .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-semibold text-2xl tracking-tight">Settings</h1>
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <nav className="flex flex-row gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-visible [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ label, href }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 max-w-2xl flex-1">{children}</div>
      </div>
    </div>
  );
}
