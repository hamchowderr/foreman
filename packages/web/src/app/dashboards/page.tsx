import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  defaultSpecFromRecords,
  getLatestSnapshot,
  listSnapshotApps,
} from "@/lib/dashboards-client";
import { createClient } from "@/lib/server";

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
  // No ?app= → default to the workspace's most-recently-refreshed app instead of
  // a hardcoded one, so the page shows real data when any exists (foreman-djo7).
  let appKey = app?.trim() || "";
  if (!appKey) {
    const apps = await listSnapshotApps(session.access_token);
    appKey = apps[0]?.appKey ?? "";
  }

  let snapshotErr: string | null = null;
  let snapshot = null;
  if (appKey) {
    try {
      snapshot = await getLatestSnapshot(appKey, session.access_token);
    } catch (e) {
      snapshotErr = (e as Error).message;
    }
  }

  const spec = snapshot ? defaultSpecFromRecords(appKey, snapshot.records) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {spec ? spec.title : appKey ? `${appKey} app` : "Apps"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {snapshot
            ? `${snapshot.rowCount} records · refreshed ${new Date(snapshot.refreshedAt).toLocaleString()}`
            : "Live view of data pulled from your connected apps."}
        </p>
      </div>

      {snapshotErr ? (
        <Alert variant="destructive">
          <AlertDescription>Couldn't load app: {snapshotErr}</AlertDescription>
        </Alert>
      ) : spec && snapshot ? (
        <DashboardRenderer spec={spec} data={snapshot.records} />
      ) : (
        <EmptyState appKey={appKey} />
      )}
    </main>
  );
}

function EmptyState({ appKey }: { appKey: string }) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyTitle>{appKey ? `No data for "${appKey}" yet` : "No app data yet"}</EmptyTitle>
        <EmptyDescription>
          Ask Foreman in chat to pull data from one of your connected apps (or set up a poll
          trigger). A snapshot is stored and an app — a live dashboard or internal tool — fills in
          here automatically.
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
