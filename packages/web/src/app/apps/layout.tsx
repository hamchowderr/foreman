import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

/**
 * Wraps /apps and /apps/[id] in the shared app shell (sidebar). Next 16
 * `cacheComponents` requires dynamic APIs (cookies(), searchParams) under a Suspense
 * boundary; the page reads SSR session + search params, so the boundary stays.
 */
export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
