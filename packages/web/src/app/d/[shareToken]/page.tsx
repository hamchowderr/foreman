import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { getPublicDashboard } from "@/lib/apps-client";

// Public, logged-out share page. No auth: the token in the URL is the capability
// (validated + expiry-checked by the agent's /apps/public/:token endpoint).
// Rendered dynamically (fetch is no-store) so a share reflects the latest
// snapshot — matches the in-app dashboard view. (Route-segment `revalidate` ISR
// is incompatible with this app's Next 16 `cacheComponents` config.)
export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const dashboard = await getPublicDashboard(shareToken);
  if (!dashboard) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandHeader label={<span className="text-sm text-muted-foreground">Shared app</span>} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-semibold text-2xl tracking-tight" style={{ color: "#201515" }}>
            {dashboard.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#7A6A5C" }}>
            {dashboard.rowCount} records · updated {new Date(dashboard.updatedAt).toLocaleString()}
          </p>
        </div>
        <DashboardRenderer data={dashboard.records} spec={dashboard.spec} />
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground sm:px-8">
        Built with{" "}
        <Link className="font-medium hover:underline" href="/">
          Foreman
        </Link>
      </footer>
    </div>
  );
}
