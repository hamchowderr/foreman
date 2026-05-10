import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import { listWorkflows, type WorkflowSummary } from "@/lib/workflows-client";

export default async function WorkflowsListPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  let workflows: WorkflowSummary[] = [];
  let loadError: string | null = null;
  try {
    workflows = await listWorkflows(session.access_token);
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#201515" }}>
            Saved workflows
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#7A6A5C" }}>
            Workflows you've saved from chat. Re-run, schedule, or delete from here.
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          className="rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: "#FFD7B5", backgroundColor: "#FFF5EB", color: "#7A4A1A" }}
        >
          Couldn't load workflows: {loadError}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y rounded-lg border" style={{ borderColor: "#FFF3E6" }}>
          {workflows.map((w) => (
            <li key={w.id}>
              <Link
                href={`/workflows/${w.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-black/[0.02]"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate" style={{ color: "#201515" }}>
                    {w.name}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "#7A6A5C" }}>
                    {w.parameters.length === 0
                      ? "no parameters"
                      : `parameters: ${w.parameters.join(", ")}`}
                  </div>
                </div>
                <div className="text-xs whitespace-nowrap pl-4" style={{ color: "#7A6A5C" }}>
                  updated {formatRelative(w.updated_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-lg border px-8 py-12 text-center"
      style={{ borderColor: "#FFF3E6", backgroundColor: "#FFF" }}
    >
      <div className="text-base font-medium" style={{ color: "#201515" }}>
        No workflows saved yet
      </div>
      <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "#7A6A5C" }}>
        After Foreman runs a multi-step or recurring task in chat, you'll be offered to save it.
        Saved workflows show up here.
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

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
