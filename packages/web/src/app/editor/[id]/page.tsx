import { AgentEditor } from "@/components/editor/agent-editor";

export default async function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentEditor agentId={id} />;
}
