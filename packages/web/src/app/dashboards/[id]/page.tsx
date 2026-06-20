import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
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
    <div className="min-h-svh bg-background">
      <BrandHeader
        label={
          <Link className="text-sm text-muted-foreground hover:underline" href="/dashboards">
            Dashboards
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-semibold text-2xl tracking-tight" style={{ color: "#201515" }}>
            {artifact.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#7A6A5C" }}>
            {artifact.rowCount} records · updated {new Date(artifact.updatedAt).toLocaleString()}
          </p>
        </div>
        <DashboardRenderer data={artifact.records} spec={artifact.spec} />
      </main>
    </div>
  );
}
