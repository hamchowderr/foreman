import { redirect } from "next/navigation";
import { WorkspacesManager } from "@/components/workspaces/workspaces-manager";
import { createClient } from "@/lib/server";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 font-semibold text-2xl tracking-tight">Workspaces</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Manage your workspaces, members, invitations, and connection settings.
      </p>
      <WorkspacesManager />
    </main>
  );
}
