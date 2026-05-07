"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Integrations", href: "/settings/integrations" },
  { label: "API Keys", href: "/settings/integrations/mcp" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-svh flex flex-col"
      style={{ backgroundColor: "#FFFDF9" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-8 py-4"
        style={{ borderBottom: "1px solid #FFF3E6" }}
      >
        <Link href="/chat" className="flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white text-sm font-bold"
            style={{ backgroundColor: "#FF4F00" }}
          >
            F
          </span>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "#201515" }}
          >
            Foreman
          </span>
        </Link>
        <span className="text-sm" style={{ color: "#FFBF6E" }}>
          /
        </span>
        <span className="text-sm font-medium" style={{ color: "#201515" }}>
          Settings
        </span>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="w-52 shrink-0 px-4 py-8"
          style={{ borderRight: "1px solid #FFF3E6" }}
        >
          <nav className="flex flex-col gap-1">
            {NAV.map(({ label, href }) => {
              const active =
                pathname === href ||
                (href !== "/settings" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "text-white" : "hover:bg-black/5",
                  )}
                  style={
                    active
                      ? { backgroundColor: "#FF4F00", color: "#fff" }
                      : { color: "#201515" }
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 px-10 py-8 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
