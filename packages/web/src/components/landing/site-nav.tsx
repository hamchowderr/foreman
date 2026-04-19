"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-5 w-5 rounded-sm bg-accent" />
          <span>Foreman</span>
          <span className="hidden sm:inline text-xs font-normal text-muted border border-border rounded-full px-2 py-0.5 ml-1">
            alpha
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-5 text-sm">
          <a
            href="#how"
            className="hidden sm:inline text-muted hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#channels"
            className="hidden sm:inline text-muted hover:text-foreground"
          >
            Channels
          </a>
          <a
            href="#hosting"
            className="hidden sm:inline text-muted hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="https://github.com/hamchowderr/foreman"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline text-muted hover:text-foreground"
          >
            GitHub
          </a>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium hover:opacity-90"
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/chat"
              className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              Open chat
            </Link>
          </Show>
        </div>
      </div>
    </nav>
  );
}
