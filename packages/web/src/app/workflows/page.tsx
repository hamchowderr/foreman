"use client";

import { useEffect, useState } from "react";
import {
  listWorkflows,
  streamWorkflowRun,
  type WorkflowSummary,
} from "@/lib/api-client";
import Link from "next/link";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);

  useEffect(() => {
    listWorkflows()
      .then(setWorkflows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRun(workflowId: string) {
    setRunningId(workflowId);
    setRunStatus("Starting...");

    try {
      for await (const event of streamWorkflowRun(workflowId)) {
        if (event.type === "status") {
          setRunStatus(`Status: ${event.status}`);
        } else if (event.type === "step") {
          setRunStatus(
            `Step ${event.order}: ${event.status}`
          );
        } else if (event.type === "complete") {
          setRunStatus("Complete");
        } else if (event.type === "error") {
          setRunStatus(`Error: ${event.message}`);
        }
      }
    } catch (err) {
      setRunStatus(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setRunningId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading workflows...</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Workflows</h1>

      {runStatus && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#f0f0f0",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 14,
          }}
        >
          {runStatus}
        </div>
      )}

      {workflows.length === 0 ? (
        <p>No workflows yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Created</th>
              <th style={th}>Updated</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf.id}>
                <td style={td}>
                  <Link href={`/workflows/${wf.id}`}>{wf.name}</Link>
                </td>
                <td style={td}>
                  {new Date(wf.created_at).toLocaleDateString()}
                </td>
                <td style={td}>
                  {new Date(wf.updated_at).toLocaleDateString()}
                </td>
                <td style={td}>
                  <button
                    onClick={() => handleRun(wf.id)}
                    disabled={runningId !== null}
                    style={{
                      padding: "4px 12px",
                      cursor: runningId ? "not-allowed" : "pointer",
                    }}
                  >
                    {runningId === wf.id ? "Running..." : "Run"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
