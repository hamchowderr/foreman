import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WorkflowsShell } from "@/components/workflows/workflows-shell";
import { createClient } from "@/lib/server";

async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  return <WorkflowsShell>{children}</WorkflowsShell>;
}

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<WorkflowsShell>{children}</WorkflowsShell>}>
      <AuthedLayout>{children}</AuthedLayout>
    </Suspense>
  );
}
