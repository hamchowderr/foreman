"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getWorkflow,
  listWorkflowRuns,
  streamWorkflowRun,
  type WorkflowDetail,
  type WorkflowRunSummary,
} from "@/lib/api-client";
import Link from "next/link";

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getWorkflow(id), listWorkflowRuns(id)])
      .then(([wfDetail, wfRuns]) => {
        setDetail(wfDetail);
        setRuns(wfRuns);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRun() {
    setRunning(true);
    setRunStatus("Starting...");

    try {
      for await (const event of streamWorkflowRun(id)) {
        if (event.type === "status") {
          setRunStatus(`Status: ${event.status}`);
        } else if (event.type === "step") {
          setRunStatus(`Step ${event.order}: ${event.status}`);
        } else if (event.type === "complete") {
          setRunStatus("Complete");
          // Refresh runs list
          listWorkflowRuns(id).then(setRuns).catch(() => {});
        } else if (event.type === "error") {
          setRunStatus(`Error: ${event.message}`);
        }
      }
    } catch (err) {
      setRunStatus(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>Error: {error}</div>;
  if (!detail) return <div style={{ padding: 24 }}>Workflow not found.</div>;

  const { workflow, steps } = detail;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/workflows">&larr; All Workflows</Link>

      <h1 style={{ marginTop: 12 }}>{workflow.name}</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Created {new Date(workflow.created_at).toLocaleString()}
      </p>

      <div style={{ marginBottom: 24 }}>
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            padding: "8px 20px",
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? "Running..." : "Run Workflow"}
        </button>
        {runStatus && (
          <span
            style={{
              marginLeft: 12,
              fontFamily: "monospace",
              fontSize: 14,
            }}
          >
            {runStatus}
          </span>
        )}
      </div>

      <h2>Steps ({steps.length})</h2>
      {steps.length === 0 ? (
        <p>No steps defined.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Step ID</th>
              <th style={th}>Template</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <td style={td}>{step.order}</td>
                <td style={td}>
                  <code>{step.id}</code>
                </td>
                <td style={td}>
                  <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(step.proposal_template, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Run History ({runs.length})</h2>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Run ID</th>
              <th style={th}>Status</th>
              <th style={th}>Started</th>
              <th style={th}>Completed</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td style={td}>
                  <code style={{ fontSize: 12 }}>{run.id.slice(0, 8)}...</code>
                </td>
                <td style={td}>
                  <StatusBadge status={run.status} />
                </td>
                <td style={td}>
                  {new Date(run.created_at).toLocaleString()}
                </td>
                <td style={td}>
                  {run.completed_at
                    ? new Date(run.completed_at).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "#888",
    running: "#2563eb",
    success: "#16a34a",
    failed: "#dc2626",
    declined: "#ca8a04",
  };
  return (
    <span
      style={{
        color: colors[status] ?? "#888",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {status}
    </span>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "2px solid #ccc",
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
};
