import { Suspense } from "react";
import { AgentListView } from "@/components/editor/agent-list-view";

export default function EditorIndexPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading…</div>}>
      <AgentListView />
    </Suspense>
  );
}
