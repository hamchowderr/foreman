import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <div className="min-h-svh bg-background">
      <BrandHeader
        label={<span className="text-sm font-medium text-foreground">Dashboards</span>}
      />

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
          <Alert variant="destructive">
            <AlertDescription>Couldn't load dashboard: {snapshotErr}</AlertDescription>
          </Alert>
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
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyTitle>No data for "{appKey}" yet</EmptyTitle>
        <EmptyDescription>
          Once a poll trigger pulls records from this app, a snapshot is stored and this dashboard
          fills in automatically. Pass <code>?app=&lt;appKey&gt;</code> to view a different source.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          href="/chat"
          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Go to chat
        </Link>
      </EmptyContent>
    </Empty>
  );
}
