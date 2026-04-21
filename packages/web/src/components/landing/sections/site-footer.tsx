import Link from "next/link";
import { Suspense } from "react";
import { CurrentYear } from "@/components/landing/current-year";

const COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Channels", href: "#channels" },
      { label: "Pricing", href: "#hosting" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "GitHub", href: "https://github.com/hamchowderr/foreman", external: true },
      { label: "Changelog", href: "https://github.com/hamchowderr/foreman/releases", external: true },
    ],
  },
  {
    heading: "Get in touch",
    links: [
      { label: "tylan@otakusolutions.io", href: "mailto:tylan@otakusolutions.io" },
      { label: "Sign in", href: "/chat" },
      { label: "Issues", href: "https://github.com/hamchowderr/foreman/issues", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground text-[11px] font-bold">
                F
              </span>
              <span className="font-semibold text-foreground">Foreman</span>
            </div>
            <p className="text-xs text-muted mt-3 leading-relaxed max-w-[220px]">
              Execute actions, manage tables, and query 9,000+ apps through your Zapier account.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60 mb-3">
                {col.heading}
              </h3>
              <ul className="space-y-2 text-sm">
                {col.links.map((link) => {
                  const className = "text-muted hover:text-foreground transition-colors break-words";
                  if (link.external) {
                    return (
                      <li key={link.label}>
                        <a href={link.href} target="_blank" rel="noreferrer" className={className}>
                          {link.label}
                        </a>
                      </li>
                    );
                  }
                  if (link.href.startsWith("#") || link.href.startsWith("mailto:")) {
                    return (
                      <li key={link.label}>
                        <a href={link.href} className={className}>
                          {link.label}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.label}>
                      <Link href={link.href} className={className}>
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted">
          <span>&copy; <Suspense fallback={null}><CurrentYear /></Suspense> Otaku Solutions. MIT-licensed.</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Alpha
            </span>
            Built with Mastra.
          </span>
        </div>
      </div>
    </footer>
  );
}
