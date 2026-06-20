import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import { listRuns } from "@/lib/workflows-client";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const runs = await listRuns(id, session.access_token).catch(() => []);
  const run = runs.find((r) => r.id === runId);
  if (!run) notFound();

  const duration =
    run.completed_at && run.created_at
      ? Math.round(
          (new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000,
        )
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/workflows/${id}`}
          className="text-xs hover:underline"
          style={{ color: "#7A6A5C" }}
        >
          ← Back to workflow
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "#201515" }}>
          Run · {new Date(run.created_at).toLocaleString()}
        </h1>
        <p className="mt-1 text-xs" style={{ color: "#7A6A5C" }}>
          status: <span style={{ color: "#201515" }}>{run.status}</span>
          {" · started by: "}
          <span style={{ color: "#201515" }}>{run.fired_by ?? "manual"}</span>
          {duration != null ? (
            <>
              {" · duration: "}
              <span style={{ color: "#201515" }}>{duration}s</span>
            </>
          ) : null}
        </p>
        {run.status === "failed" && run.error_message ? (
          <p
            className="mt-2 break-words rounded border px-3 py-2 text-xs"
            style={{ borderColor: "#FAD2CE", backgroundColor: "#FFF6F5", color: "#A61B1B" }}
          >
            {run.error_message}
          </p>
        ) : null}
      </div>

      <section>
        <h2
          className="mb-2 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "#7A6A5C" }}
        >
          Inputs
        </h2>
        {Object.keys(run.inputs ?? {}).length === 0 ? (
          <p className="text-sm" style={{ color: "#7A6A5C" }}>
            No inputs.
          </p>
        ) : (
          <pre
            className="overflow-x-auto rounded border p-3 text-xs"
            style={{ borderColor: "#FFF3E6", backgroundColor: "#FFF" }}
          >
            {JSON.stringify(run.inputs, null, 2)}
          </pre>
        )}
      </section>

      <p className="text-xs" style={{ color: "#7A6A5C" }}>
        Per-step input/output capture is on the roadmap. For now the run shows status, timing, and
        the inputs you provided. The agent server logs hold full step traces.
      </p>
    </div>
  );
}
