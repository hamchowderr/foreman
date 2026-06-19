import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    <div className="min-h-svh" style={{ backgroundColor: "#FFFDF9" }}>
      <header
        className="flex items-center gap-4 px-6 py-4 sm:px-8"
        style={{ borderBottom: "1px solid #FFF3E6" }}
      >
        <Link className="flex items-center gap-2.5" href="/chat">
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
        <Link className="text-sm hover:underline" href="/dashboards" style={{ color: "#7A6A5C" }}>
          Dashboards
        </Link>
      </header>

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
