import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TriggerControls } from "@/components/workflows/trigger-controls";
import { WorkflowDetailActions } from "@/components/workflows/workflow-detail-actions";
import { createClient } from "@/lib/server";
import {
  getWorkflow,
  listRuns,
  listTriggers,
  type WorkflowRun,
  type WorkflowTrigger,
} from "@/lib/workflows-client";

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  let detail: Awaited<ReturnType<typeof getWorkflow>>;
  try {
    detail = await getWorkflow(id, session.access_token);
  } catch {
    notFound();
  }
  const [{ triggers }, runs] = await Promise.all([
    listTriggers(id, session.access_token).catch(() => ({ triggers: [] as WorkflowTrigger[] })),
    listRuns(id, session.access_token).catch(() => [] as WorkflowRun[]),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/workflows" className="text-xs hover:underline" style={{ color: "#7A6A5C" }}>
          ← All workflows
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "#201515" }}>
          {detail.workflow.name}
        </h1>
        <p className="mt-1 text-xs" style={{ color: "#7A6A5C" }}>
          {detail.workflow.parameters.length === 0
            ? "no parameters"
            : `parameters: ${detail.workflow.parameters.join(", ")}`}
        </p>
      </div>

      <WorkflowDetailActions workflowId={detail.workflow.id} currentName={detail.workflow.name} />

      <Section title="Steps">
        <ol className="space-y-2">
          {detail.steps.map((s, i) => {
            const t = s.proposal_template;
            return (
              <li
                key={s.id}
                className="rounded border px-4 py-3"
                style={{ borderColor: "#FFF3E6", backgroundColor: "#FFF" }}
              >
                <div className="text-xs uppercase tracking-wide" style={{ color: "#7A6A5C" }}>
                  Step {i + 1}
                </div>
                <div className="text-sm font-medium" style={{ color: "#201515" }}>
                  {t.human_label ?? `${t.app_key ?? "?"}.${t.action_key ?? "?"}`}
                </div>
                {t.inputs && Object.keys(t.inputs).length > 0 ? (
                  <pre
                    className="mt-2 overflow-x-auto rounded p-2 text-[11px]"
                    style={{ backgroundColor: "#FAF5EE", color: "#201515" }}
                  >
                    {JSON.stringify(t.inputs, null, 2)}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Triggers">
        {triggers.length === 0 ? (
          <p className="text-sm" style={{ color: "#7A6A5C" }}>
            No triggers attached. Ask Foreman in chat to schedule this or bind it to a chat command.
          </p>
        ) : (
          <ul className="space-y-2">
            {triggers.map((t) => (
              <TriggerRow key={t.id} workflowId={detail.workflow.id} trigger={t} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Run history">
        {runs.length === 0 ? (
          <p className="text-sm" style={{ color: "#7A6A5C" }}>
            No runs yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" style={{ borderColor: "#FFF3E6" }}>
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/workflows/${detail.workflow.id}/runs/${r.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium" style={{ color: "#201515" }}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "#7A6A5C" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: WorkflowRun["status"] }) {
  const map: Record<WorkflowRun["status"], { bg: string; fg: string; label: string }> = {
    success: { bg: "#E6F4EA", fg: "#1B6633", label: "succeeded" },
    error: { bg: "#FCE8E6", fg: "#A61B1B", label: "failed" },
    running: { bg: "#FFF1E0", fg: "#7A4A1A", label: "running" },
  };
  const s = map[status] ?? map.running;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function TriggerRow({ workflowId, trigger }: { workflowId: string; trigger: WorkflowTrigger }) {
  return (
    <li
      className="flex items-center justify-between rounded border px-4 py-3"
      style={{ borderColor: "#FFF3E6", backgroundColor: "#FFF" }}
    >
      <div className="text-sm">
        <div className="font-medium" style={{ color: "#201515" }}>
          {triggerLabel(trigger)}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: "#7A6A5C" }}>
          {trigger.last_fired_at
            ? `last fired ${new Date(trigger.last_fired_at).toLocaleString()}`
            : "never fired"}
        </div>
      </div>
      <TriggerControls workflowId={workflowId} trigger={trigger} />
    </li>
  );
}

function triggerLabel(t: WorkflowTrigger): string {
  if (t.type === "cron") {
    const c = t.config as { schedule?: string; timezone?: string };
    return `Cron · ${c.schedule ?? "?"}${c.timezone ? ` (${c.timezone})` : ""}`;
  }
  if (t.type === "channel") {
    const c = t.config as { channel?: string; match?: { command?: string } };
    return `Channel · ${c.channel ?? "?"}${c.match?.command ? ` · ${c.match.command}` : ""}`;
  }
  return `${t.type}`;
}
