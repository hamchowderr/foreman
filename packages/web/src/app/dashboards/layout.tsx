import { Suspense } from "react";

/**
 * Next 16 `cacheComponents` requires dynamic APIs (cookies(), searchParams) to
 * resolve under a Suspense boundary. The page reads the SSR session + search
 * params, so wrap it here.
 */
export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
