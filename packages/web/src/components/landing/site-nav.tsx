"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

export function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground text-xs font-bold">
            F
          </span>
          <span className="text-[15px]">Foreman</span>
          <span className="hidden sm:inline text-[10px] font-medium text-accent border border-accent/30 rounded-full px-2 py-0.5 ml-0.5 uppercase tracking-wider">
            Alpha
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#channels">Channels</NavLink>
          <NavLink href="#hosting">Pricing</NavLink>
          <a
            href="https://github.com/hamchowderr/foreman"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <GitHubIcon />
            GitHub
          </a>
          <div className="w-px h-5 bg-border mx-1" />
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="sm" className="ml-1">Sign in</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button size="sm" asChild className="ml-1">
              <Link href="/chat">Open chat</Link>
            </Button>
          </Show>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-3 animate-fade-in">
          <a href="#features" className="block text-sm text-muted hover:text-foreground" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#how" className="block text-sm text-muted hover:text-foreground" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#channels" className="block text-sm text-muted hover:text-foreground" onClick={() => setMobileOpen(false)}>Channels</a>
          <a href="#hosting" className="block text-sm text-muted hover:text-foreground" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="https://github.com/hamchowderr/foreman" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <GitHubIcon /> GitHub
          </a>
          <div className="pt-2">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button className="w-full">Sign in</Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button asChild className="w-full">
                <Link href="/chat">Open chat</Link>
              </Button>
            </Show>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors rounded-md hover:bg-surface"
    >
      {children}
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
