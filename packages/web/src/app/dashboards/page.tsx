import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { defaultSpecFromRecords, getLatestSnapshot } from "@/lib/dashboards-client";
import { createClient } from "@/lib/server";

const DEFAULT_APP = "hubspot";

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const { app } = await searchParams;
  const appKey = app?.trim() || DEFAULT_APP;

  let snapshotErr: string | null = null;
  let snapshot = null;
  try {
    snapshot = await getLatestSnapshot(appKey, session.access_token);
  } catch (e) {
    snapshotErr = (e as Error).message;
  }

  const spec = snapshot ? defaultSpecFromRecords(appKey, snapshot.records) : null;

  return (
    <div className="min-h-svh" style={{ backgroundColor: "#FFFDF9" }}>
      <header
        className="flex items-center gap-4 px-6 py-4 sm:px-8"
        style={{ borderBottom: "1px solid #FFF3E6" }}
      >
        <Link href="/chat" className="flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
            style={{ backgroundColor: "#FF4F00" }}
          >
            F
          </span>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "#201515" }}>
            Foreman
          </span>
        </Link>
        <span className="text-sm" style={{ color: "#FFBF6E" }}>
          /
        </span>
        <span className="text-sm font-medium" style={{ color: "#201515" }}>
          Dashboards
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#201515" }}>
            {spec ? spec.title : `${appKey} dashboard`}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#7A6A5C" }}>
            {snapshot
              ? `${snapshot.rowCount} records · refreshed ${new Date(snapshot.refreshedAt).toLocaleString()}`
              : "Live view of data pulled from your connected app."}
          </p>
        </div>

        {snapshotErr ? (
          <div
            className="rounded-md border px-4 py-3 text-sm"
            style={{ borderColor: "#FFD7B5", backgroundColor: "#FFF5EB", color: "#7A4A1A" }}
          >
            Couldn't load dashboard: {snapshotErr}
          </div>
        ) : spec && snapshot ? (
          <DashboardRenderer spec={spec} data={snapshot.records} />
        ) : (
          <EmptyState appKey={appKey} />
        )}
      </main>
    </div>
  );
}

function EmptyState({ appKey }: { appKey: string }) {
  return (
    <div
      className="rounded-lg border px-8 py-12 text-center"
      style={{ borderColor: "#FFF3E6", backgroundColor: "#FFF" }}
    >
      <div className="text-base font-medium" style={{ color: "#201515" }}>
        No data for "{appKey}" yet
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "#7A6A5C" }}>
        Once a poll trigger pulls records from this app, a snapshot is stored and this dashboard
        fills in automatically. Pass <code>?app=&lt;appKey&gt;</code> to view a different source.
      </p>
      <Link
        href="/chat"
        className="mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: "#FF4F00" }}
      >
        Go to chat
      </Link>
    </div>
  );
}
