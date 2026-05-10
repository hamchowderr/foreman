import { Suspense } from "react";
import { AgentEditor } from "@/components/editor/agent-editor";

export default function AgentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted">Loading agent…</div>}>
      <AgentEditorResolver params={params} />
    </Suspense>
  );
}

async function AgentEditorResolver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentEditor agentId={id} />;
}
