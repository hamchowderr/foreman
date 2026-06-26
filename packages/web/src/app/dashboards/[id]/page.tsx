import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { ShareButton } from "@/components/dashboard/share-button";
import { ArrowLeft } from "@/components/icons/hi";
import { getArtifact } from "@/lib/dashboards-client";
import { createClient } from "@/lib/server";

export default async function DashboardArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const { id } = await params;
  const artifact = await getArtifact(id, session.access_token);
  if (!artifact) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Link
        href="/dashboards"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboards
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight text-foreground">
            {artifact.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {artifact.rowCount} records · updated {new Date(artifact.updatedAt).toLocaleString()}
          </p>
        </div>
        <ShareButton artifactId={artifact.id} />
      </div>
      <DashboardRenderer data={artifact.records} spec={artifact.spec} />
    </main>
  );
}
